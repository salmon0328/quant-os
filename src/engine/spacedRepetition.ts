import type { KnowledgeEntry } from '../models';
import { addDays, daysBetween, today } from '../lib/date';

// Spaced-repetition intervals (days): Day 1, 3, 7, 14, 30, then monthly.
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
