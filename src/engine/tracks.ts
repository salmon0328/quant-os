import type { AppState, TrackCursor, TrackId } from '../models';
import { EMPTY_CURSOR } from '../models';
import { LEETCODE, type LeetProblem } from '../data/tracks/leetcode';
import { TERMINAL, type TerminalFunction } from '../data/tracks/bloomberg';
import { READING, type ReadingUnit } from '../data/tracks/reading';

/**
 * Track cursors: the thing that makes a task cumulative.
 *
 * Before this, the planner picked a LeetCode *pattern* by `weekIndex % 12` and
 * cycled forever regardless of what had been solved. Here each track is an
 * ordered catalogue and the state records which item ids are done, so
 * `nextItem` always returns the next unfinished one and today's work builds on
 * yesterday's.
 *
 * Only ids are persisted — catalogue text stays in the bundled data modules,
 * the same split the flashcard deck uses to keep the synced state small.
 */

/** Minimum shape the cursor logic needs from a catalogue item. */
interface Orderable {
  id: string;
  order: number;
  buildsOn?: string[];
}

export const TRACK_CATALOGUES = {
  leetcode: LEETCODE,
  bloomberg: TERMINAL,
  reading: READING,
} as const satisfies Record<TrackId, readonly Orderable[]>;

export function cursorFor(state: AppState, trackId: TrackId): TrackCursor {
  return state.trackProgress?.[trackId] ?? EMPTY_CURSOR;
}

function isSettled(cursor: TrackCursor, id: string): boolean {
  return cursor.completedIds.includes(id) || cursor.skippedIds.includes(id);
}

/**
 * The next item to work on: lowest `order` that is neither done nor skipped and
 * whose prerequisites are satisfied.
 *
 * A blocked item is passed over rather than blocking the whole track — being
 * unable to schedule anything is worse than scheduling slightly out of order.
 */
export function nextItem<T extends Orderable>(
  items: readonly T[],
  cursor: TrackCursor,
  filter?: (item: T) => boolean
): T | undefined {
  const ready = [...items]
    .sort((a, b) => a.order - b.order)
    .filter((i) => !isSettled(cursor, i.id) && (!filter || filter(i)));

  return (
    ready.find((i) => (i.buildsOn ?? []).every((dep) => cursor.completedIds.includes(dep))) ??
    ready[0]
  );
}

/** The next `count` items, for tasks that ask for more than one (LeetCode does two). */
export function nextItems<T extends Orderable>(
  items: readonly T[],
  cursor: TrackCursor,
  count: number,
  filter?: (item: T) => boolean
): T[] {
  const picked: T[] = [];
  // Treat already-picked ids as settled so the same item is never returned twice.
  const working: TrackCursor = { ...cursor, skippedIds: [...cursor.skippedIds] };
  for (let i = 0; i < count; i++) {
    const item = nextItem(items, working, filter);
    if (!item) break;
    picked.push(item);
    working.skippedIds.push(item.id);
  }
  return picked;
}

// ------------------------------------------------------------------ writes

/**
 * Records catalogue items as done. Returns a patch rather than mutating, to
 * match how every other store helper works.
 */
export function completeItems(
  state: AppState,
  trackId: TrackId,
  itemIds: string[],
  dateISO: string
): Pick<AppState, 'trackProgress'> {
  const cursor = cursorFor(state, trackId);
  const merged = [...new Set([...cursor.completedIds, ...itemIds])];
  return {
    trackProgress: {
      ...state.trackProgress,
      [trackId]: { ...cursor, completedIds: merged, lastDoneDate: dateISO },
    },
  };
}

/** Un-ticking a task must not leave the cursor advanced past work not done. */
export function uncompleteItems(
  state: AppState,
  trackId: TrackId,
  itemIds: string[]
): Pick<AppState, 'trackProgress'> {
  const cursor = cursorFor(state, trackId);
  return {
    trackProgress: {
      ...state.trackProgress,
      [trackId]: { ...cursor, completedIds: cursor.completedIds.filter((id) => !itemIds.includes(id)) },
    },
  };
}

/**
 * Pass over items permanently — a premium problem, or a chapter you already
 * know. Takes a list because a single task can carry several items, and
 * applying them one at a time would mean several patches racing on stale state.
 */
export function skipItems(state: AppState, trackId: TrackId, itemIds: string[]): Pick<AppState, 'trackProgress'> {
  const cursor = cursorFor(state, trackId);
  return {
    trackProgress: {
      ...state.trackProgress,
      [trackId]: { ...cursor, skippedIds: [...new Set([...cursor.skippedIds, ...itemIds])] },
    },
  };
}

// --------------------------------------------------------------- reporting

export interface TrackSummary {
  trackId: TrackId;
  label: string;
  done: number;
  total: number;
  /** Where you are now — "Ch.10", "GP", the problem title. */
  nextLabel?: string;
}

const TRACK_LABEL: Record<TrackId, string> = {
  leetcode: 'LeetCode',
  bloomberg: 'Bloomberg',
  reading: 'Reading',
};

export function trackSummaries(state: AppState): TrackSummary[] {
  const cursor = (id: TrackId) => cursorFor(state, id);

  const leetNext = nextItem(LEETCODE, cursor('leetcode'), (p) => !p.premium) as LeetProblem | undefined;
  const bbNext = nextItem(TERMINAL, cursor('bloomberg')) as TerminalFunction | undefined;
  const readNext = nextItem(READING, cursor('reading')) as ReadingUnit | undefined;

  return [
    {
      trackId: 'leetcode',
      label: TRACK_LABEL.leetcode,
      done: cursor('leetcode').completedIds.length,
      total: LEETCODE.length,
      nextLabel: leetNext?.title,
    },
    {
      trackId: 'bloomberg',
      label: TRACK_LABEL.bloomberg,
      done: cursor('bloomberg').completedIds.length,
      total: TERMINAL.length,
      nextLabel: bbNext?.mnemonic,
    },
    {
      trackId: 'reading',
      label: TRACK_LABEL.reading,
      done: cursor('reading').completedIds.length,
      total: READING.length,
      nextLabel: readNext ? `${readNext.bookLabel.split('—')[0].trim()} Ch.${readNext.chapter}` : undefined,
    },
  ];
}
