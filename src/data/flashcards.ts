import type { CardProgress, Flashcard, FlashcardSeed } from '../models';
import { addDays, today } from '../lib/date';
import { SRS_INTERVALS } from '../engine/spacedRepetition';

let cached: FlashcardSeed[] | null = null;

/**
 * The deck is ~200KB, so it is imported on demand rather than shipped in the
 * main bundle. Card text never enters app state — only progress does.
 */
export async function loadDeck(): Promise<Flashcard[]> {
  if (!cached) {
    const mod = await import('./flashcards.generated');
    cached = mod.FLASHCARD_SEEDS;
  }
  return mergeDeck(cached, {});
}

/** Stable id derived from the question text, so regenerating the deck is safe. */
export function cardId(seed: FlashcardSeed): string {
  let h = 2166136261;
  const s = seed.question.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fc-${(h >>> 0).toString(36)}`;
}

export function mergeDeck(seeds: FlashcardSeed[], progress: Record<string, CardProgress>): Flashcard[] {
  return seeds.map((s) => {
    const id = cardId(s);
    const p = progress[id];
    return {
      id,
      deck: s.deck,
      section: s.section,
      question: s.question,
      answer: s.answer,
      quality: s.quality ?? 'fair',
      srsStage: p?.srsStage ?? 0,
      nextReview: p?.nextReview ?? today(),
      lastReviewed: p?.lastReviewed,
      timesSeen: p?.timesSeen ?? 0,
      timesCorrect: p?.timesCorrect ?? 0,
    };
  });
}

export function gradeCard(prev: CardProgress | undefined, remembered: boolean): CardProgress {
  const stage0 = prev?.srsStage ?? 0;
  const stage = remembered ? Math.min(stage0 + 1, SRS_INTERVALS.length - 1) : Math.max(stage0 - 1, 0);
  return {
    srsStage: stage,
    lastReviewed: today(),
    nextReview: addDays(today(), SRS_INTERVALS[stage]),
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    timesCorrect: (prev?.timesCorrect ?? 0) + (remembered ? 1 : 0),
  };
}

export type DeckFilter = 'all' | 'due' | 'new' | 'high';

/** Build today's queue: due first, then unseen, then thinnest coverage. */
export function buildQueue(cards: Flashcard[], filter: DeckFilter, limit: number, date = today()): Flashcard[] {
  const due = cards.filter((c) => c.nextReview <= date);
  const unseen = cards.filter((c) => c.timesSeen === 0);

  let pool: Flashcard[];
  switch (filter) {
    case 'due':
      pool = due;
      break;
    case 'new':
      pool = unseen;
      break;
    case 'high':
      pool = cards.filter((c) => c.quality === 'high' && c.nextReview <= date);
      break;
    default:
      pool = [...due, ...unseen.filter((c) => !due.includes(c))];
  }

  if (pool.length === 0) {
    // Nothing is due — revision beats idling, so review the weakest cards.
    pool = [...cards].sort(
      (a, b) => (a.timesCorrect / Math.max(1, a.timesSeen)) - (b.timesCorrect / Math.max(1, b.timesSeen))
    );
  }

  // Deterministic-ish shuffle so the same cards don't always come first.
  return [...pool].sort(() => Math.random() - 0.5).slice(0, limit);
}
