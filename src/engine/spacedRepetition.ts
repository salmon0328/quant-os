import type { CardProgress, KnowledgeEntry, RecallGrade } from '../models';
import { addDays, daysBetween, today } from '../lib/date';

// ---------------------------------------------------------------------------
// Concept cards (KnowledgeEntry) — staged intervals with an escalating action.
// These are hand-written concepts, few in number, where the *action* matters as
// much as the timing, so they keep the simpler stage ladder.
// ---------------------------------------------------------------------------

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60];

export const SRS_ACTIONS = [
  'Learn it — write the definition & intuition in your own words',
  'Recall the formula and intuition from memory',
  'Solve a problem using it',
  'Implement it in code',
  'Apply it to real market/data',
  'Teach it — write a short explainer',
];

export function scheduleNextReview(entry: KnowledgeEntry, remembered: boolean): KnowledgeEntry {
  let stage = entry.srsStage ?? 0;
  stage = remembered ? Math.min(stage + 1, SRS_INTERVALS.length - 1) : Math.max(stage - 1, 0);
  const interval = SRS_INTERVALS[stage];
  return {
    ...entry,
    srsStage: stage,
    lastReviewed: today(),
    nextReview: addDays(today(), interval),
  };
}

export function initReview(entry: KnowledgeEntry): KnowledgeEntry {
  if (entry.nextReview) return entry;
  return { ...entry, srsStage: 0, nextReview: today() };
}

export function dueForReview(entries: KnowledgeEntry[], date = today()): KnowledgeEntry[] {
  return entries.filter((e) => e.nextReview && daysBetween(e.nextReview, date) >= 0);
}

export function srsActionFor(entry: KnowledgeEntry): string {
  return SRS_ACTIONS[Math.min(entry.srsStage ?? 0, SRS_ACTIONS.length - 1)];
}

// ---------------------------------------------------------------------------
// Interview deck — SM-2.
//
// The deck ran on the same ±1 walk over a fixed ladder as the concepts above,
// which treats every card the same regardless of how hard *you* find it. SM-2
// gives each card its own ease factor, so cards you keep missing come back
// often and cards you find trivial stop wasting your time.
// ---------------------------------------------------------------------------

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const DEFAULT_EASE = 2.5;
/** Ease delta per grade — the standard SM-2 response curve. */
const EASE_DELTA: Record<RecallGrade, number> = {
  again: -0.20,
  hard: -0.15,
  good: 0,
  easy: +0.15,
};

const FIRST_INTERVAL: Record<Exclude<RecallGrade, 'again'>, number> = {
  hard: 1,
  good: 1,
  easy: 4,
};

/**
 * A lapse keeps a fraction of the interval rather than resetting to zero — but
 * capped hard. Without the cap, forgetting a card on a 328-day interval would
 * reschedule it 98 days out, which is useless: you just demonstrated you do not
 * know it, so it has to come back this week.
 */
const LAPSE_FACTOR = 0.3;
const LAPSE_MAX_DAYS = 7;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Older saves have only `srsStage`. Recover an interval and a neutral ease so
 * existing progress keeps its schedule instead of resetting to day one.
 */
export function normaliseProgress(prev: CardProgress | undefined): {
  ease: number;
  interval: number;
  streak: number;
  lapses: number;
} {
  if (!prev) return { ease: DEFAULT_EASE, interval: 0, streak: 0, lapses: 0 };
  const stage = prev.srsStage ?? 0;
  return {
    ease: prev.ease ?? DEFAULT_EASE,
    interval: prev.interval ?? SRS_INTERVALS[Math.min(stage, SRS_INTERVALS.length - 1)] ?? 0,
    streak: prev.streak ?? stage,
    lapses: prev.lapses ?? 0,
  };
}

export function nextInterval(prev: CardProgress | undefined, grade: RecallGrade): number {
  const { ease, interval, streak } = normaliseProgress(prev);

  if (grade === 'again') {
    // Keep a little of what was learned, but bring it back within the week.
    return clamp(Math.round(interval * LAPSE_FACTOR), 1, LAPSE_MAX_DAYS);
  }
  // First two successful reviews use fixed steps; SM-2 only multiplies after that.
  if (streak === 0) return FIRST_INTERVAL[grade];
  if (streak === 1) return grade === 'easy' ? 6 : 3;

  const multiplier = grade === 'hard' ? 1.2 : grade === 'easy' ? ease * 1.3 : ease;
  return Math.max(1, Math.round(interval * multiplier));
}

/** Applies one review. Pure — returns the new progress, never mutates. */
export function gradeProgress(
  prev: CardProgress | undefined,
  grade: RecallGrade,
  date = today()
): CardProgress {
  const { ease, streak, lapses } = normaliseProgress(prev);
  const failed = grade === 'again';
  const interval = nextInterval(prev, grade);
  const newEase = clamp(ease + EASE_DELTA[grade], MIN_EASE, MAX_EASE);

  return {
    // srsStage is kept roughly in step so anything still reading it (the task
    // generator's copy, old exports) keeps working.
    srsStage: failed ? 0 : Math.min((prev?.srsStage ?? 0) + 1, SRS_INTERVALS.length - 1),
    ease: newEase,
    interval,
    streak: failed ? 0 : streak + 1,
    lapses: lapses + (failed ? 1 : 0),
    lastReviewed: date,
    nextReview: addDays(date, interval),
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    timesCorrect: (prev?.timesCorrect ?? 0) + (failed ? 0 : 1),
  };
}

/** A 0-3 score from the AI grader maps onto the same four buttons. */
export function gradeFromScore(score: number): RecallGrade {
  if (score <= 0) return 'again';
  if (score === 1) return 'hard';
  if (score === 2) return 'good';
  return 'easy';
}

/** Human-readable preview for the review buttons ("Good · 6d"). */
export function intervalPreview(prev: CardProgress | undefined, grade: RecallGrade): string {
  const days = nextInterval(prev, grade);
  // Days up to ~3 months: rounding 75d and 98d both to "3mo" hides a real
  // difference between two buttons sitting next to each other.
  if (days <= 90) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
