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
      page: s.page,
      confidence: s.confidence,
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
function matchesFilter(c: Flashcard, filter: DeckFilter, date: string): boolean {
  switch (filter) {
    case 'due':
      return c.nextReview <= date;
    case 'new':
      return c.timesSeen === 0;
    case 'high':
      return c.quality === 'high' && c.nextReview <= date;
    default:
      return c.nextReview <= date || c.timesSeen === 0;
  }
}

export interface TopicGroup {
  deck: string;
  section: string;
  count: number;
}

/**
 * Topics in the order they appear in the source books, so the UI can present
 * them top-to-bottom (intro -> advanced) the way the author sequenced them.
 */
export function topicsOf(cards: Flashcard[]): TopicGroup[] {
  const byKey = new Map<string, TopicGroup>();
  for (const c of cards) {
    const key = `${c.deck}::${c.section}`;
    const group = byKey.get(key);
    if (group) group.count += 1;
    else byKey.set(key, { deck: c.deck, section: c.section, count: 1 });
  }
  return [...byKey.values()];
}

/**
 * Build today's queue.
 *  - order 'sequential' (default): walk the deck top-to-bottom so intro -> advanced
 *    topics stay in their authored reading order.
 *  - order 'shuffle': randomise for mixed recall practice.
 *  - topic: restrict to one book topic (card.section), e.g. "Intrinsic Valuation".
 */
export function buildQueue(
  cards: Flashcard[],
  filter: DeckFilter,
  limit: number,
  date = today(),
  order: 'sequential' | 'shuffle' = 'sequential',
  topic?: string
): Flashcard[] {
  const scoped = topic ? cards.filter((c) => c.section === topic) : cards;
  let pool = scoped.filter((c) => matchesFilter(c, filter, date));

  if (pool.length === 0) {
    // Nothing is due — revision beats idling, so review the weakest cards.
    pool = [...scoped].sort(
      (a, b) => a.timesCorrect / Math.max(1, a.timesSeen) - b.timesCorrect / Math.max(1, b.timesSeen)
    );
  }

  if (order === 'shuffle') {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, limit);
  }
  // Sequential: honour the deck's authored top-to-bottom order (intro -> advanced).
  return pool.slice(0, limit);
}

/**
 * Position of a card within its own topic, for a "Book > Topic > 12/48"
 * breadcrumb while drilling.
 */
export function positionIn(cards: Flashcard[], id: string): { topic: string; index: number; total: number } {
  const card = cards.find((c) => c.id === id);
  if (!card) return { topic: '', index: 0, total: 0 };
  const siblings = cards.filter((c) => c.section === card.section);
  return {
    topic: card.section,
    index: siblings.findIndex((c) => c.id === id) + 1,
    total: siblings.length,
  };
}
