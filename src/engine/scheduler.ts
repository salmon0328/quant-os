import type { FixedBlock, ScheduleSettings, Task, TimeSlot } from '../models';
import { dayOfWeek } from '../lib/date';

const DAY = 1440;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const m = ((Math.round(mins) % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The waking window in ABSOLUTE minutes. A sleep time at or before the wake
 * time means "after midnight", so sleep becomes wake+1440… or more.
 */
export function dayWindow(s: ScheduleSettings): { start: number; end: number } {
  const wake = toMinutes(s.wakeTime);
  let sleep = toMinutes(s.sleepTime);
  if (sleep <= wake) sleep += DAY;
  return { start: wake, end: sleep };
}

export function isCampusDay(s: ScheduleSettings, dateISO: string): boolean {
  return s.campusDays.includes(dayOfWeek(dateISO));
}

/** Blocks that apply to a given date (recurring by weekday, or one-off). */
export function blocksForDate(blocks: FixedBlock[], dateISO: string): FixedBlock[] {
  const dow = dayOfWeek(dateISO);
  return blocks
    .filter((b) => (b.days.length > 0 ? b.days.includes(dow) : b.date === dateISO))
    .filter((b) => b.start !== b.end)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export interface SlotResult {
  slots: TimeSlot[];
  busyMinutes: number;
  freeMinutes: number;
}

/**
 * Carve the waking day into usable gaps. Only gaps of at least `minSlot`
 * minutes survive — a 10-minute hole between lectures isn't a working slot.
 */
export function freeSlots(
  blocks: FixedBlock[],
  settings: ScheduleSettings,
  dateISO: string,
  minSlot = 25
): SlotResult {
  const { start: wake, end: sleep } = dayWindow(settings);
  const buffer = settings.bufferMinutes;

  const busy = blocksForDate(blocks, dateISO)
    .map((b) => {
      let ns = toMinutes(b.start);
      let ne = toMinutes(b.end);
      if (ne <= ns) ne += DAY; // crosses midnight
      while (ns < wake) {
        ns += DAY;
        ne += DAY;
      }
      return { start: ns, end: ne };
    })
    .filter((b) => b.end > wake && b.start < sleep)
    .sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  let cursor = wake;
  let first = true;

  const push = (s: number, e: number) => {
    if (e - s < minSlot) return;
    slots.push({
      start: fromMinutes(s),
      end: fromMinutes(e),
      minutes: Math.round(e - s),
      startAbs: s,
    });
  };

  for (const b of busy) {
    push(first ? cursor : cursor + buffer, b.start - buffer);
    cursor = Math.max(cursor, b.end);
    first = false;
  }
  push(first ? cursor : cursor + buffer, sleep);

  return {
    slots,
    busyMinutes: busy.reduce((a, b) => a + Math.max(0, Math.min(b.end, sleep) - Math.max(b.start, wake)), 0),
    freeMinutes: slots.reduce((a, s) => a + s.minutes, 0),
  };
}

export type DayPart = 'morning' | 'midday' | 'evening';

/** Parts of day in absolute minutes (morning < 12:00, midday < 17:00, else evening). */
const PART_RANGES: Record<DayPart, [number, number]> = {
  morning: [0, 12 * 60],
  midday: [12 * 60, 17 * 60],
  evening: [17 * 60, Number.MAX_SAFE_INTEGER],
};

export function partOfAbs(absMinutes: number): DayPart {
  if (absMinutes < 12 * 60) return 'morning';
  if (absMinutes < 17 * 60) return 'midday';
  return 'evening';
}

export function partOf(hhmm: string): DayPart {
  return partOfAbs(toMinutes(hhmm));
}

interface SlotState extends TimeSlot {
  cursor: number; // minutes already consumed from the start of this slot
}

/**
 * When a task names a preferred part of day, slide it forward inside the slot
 * so it actually lands there — a 7-hour gap shouldn't dump evening work at 11am.
 */
function positionIn(slot: SlotState, minutes: number, prefer?: Task['prefer']): number | null {
  const slotEnd = slot.startAbs + slot.minutes;
  let pos = slot.startAbs + slot.cursor;
  if (pos + minutes > slotEnd) return null;

  if (prefer) {
    const [ps, pe] = PART_RANGES[prefer];
    const target = Math.max(pos, ps);
    // Move into the preferred window when there's still room for the whole task.
    if (target + minutes <= Math.min(slotEnd, pe)) return target;
    if (target + minutes <= slotEnd && partOfAbs(pos) !== prefer) return target;
  }
  return pos;
}

/**
 * Greedily place tasks into free slots, honouring each task's preferred part of
 * day. Tasks that can't fit anywhere are returned with `startTime` undefined so
 * the UI can surface them honestly instead of pretending the day is infinite.
 */
export function assignTimes(tasks: Task[], slots: TimeSlot[]): Task[] {
  if (slots.length === 0) return tasks.map((t) => ({ ...t, startTime: undefined }));

  const state: SlotState[] = slots.map((s) => ({ ...s, cursor: 0 }));
  // Placement uses the caller's order, which the generator sets by cadence
  // rank. Sorting by tier or duration here would let a long optional task
  // claim the morning and push a short daily habit to the afternoon.
  const ranked = tasks;
  const placed = new Map<string, string>();

  for (const t of ranked) {
    let best: { idx: number; pos: number; score: number } | null = null;

    state.forEach((slot, idx) => {
      const pos = positionIn(slot, t.minutes, t.prefer);
      if (pos === null) return;
      // Prefer a true part-of-day match, then the earliest slot.
      const score = t.prefer && partOfAbs(pos) === t.prefer ? 0 : 1;
      if (!best || score < best.score || (score === best.score && pos < best.pos)) {
        best = { idx, pos, score };
      }
    });

    if (!best) continue;
    const hit = best as { idx: number; pos: number; score: number };
    placed.set(t.id, fromMinutes(hit.pos));
    state[hit.idx].cursor = hit.pos - state[hit.idx].startAbs + t.minutes;
  }

  return tasks.map((t) => ({ ...t, startTime: placed.get(t.id) }));
}

/** End time in wall-clock HH:MM. */
export function endTimeOf(t: Task): string {
  if (!t.startTime) return '';
  return fromMinutes(toMinutes(t.startTime) + t.minutes);
}

/** Human-readable "09:30 – 10:15". */
export function rangeLabel(t: Task): string {
  if (!t.startTime) return '';
  return `${t.startTime} – ${endTimeOf(t)}`;
}
