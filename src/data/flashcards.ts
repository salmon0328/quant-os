import type { CardProgress, CardRole, Flashcard, FlashcardSeed, RecallGrade } from '../models';
import { today } from '../lib/date';
import { gradeProgress } from '../engine/spacedRepetition';

let cached: FlashcardSeed[] | null = null;

/**
 * The deck is ~200KB, so it is imported on demand rather than shipped in the
 * main bundle. Card text never enters app state — only progress does.
 */
export async function loadSeeds(): Promise<FlashcardSeed[]> {
  if (!cached) {
    // Both decks are lazily imported together: the extracted book cards and the
    // purpose-built quant bank that rebalances them.
    const [book, quant] = await Promise.all([
      import('./flashcards.generated'),
      import('./quantbank.generated'),
    ]);
    cached = dedupe([...book.FLASHCARD_SEEDS, ...quant.QUANT_BANK_SEEDS]);
  }
  return cached;
}

/**
 * Drops cards that hash to an id already present.
 *
 * The source books overlap — "Walk me through the three financial statements"
 * appears in both WSP and BIWS — and cardId() hashes the question text, so
 * those two collide and would share one SRS progress entry. Deduping here
 * rather than changing the hash keeps every legacyIds mapping intact.
 *
 * The fuller answer wins, since the duplicate pair is the same question.
 */
function dedupe(seeds: FlashcardSeed[]): FlashcardSeed[] {
  const byId = new Map<string, FlashcardSeed>();
  for (const seed of seeds) {
    const id = cardId(seed);
    const existing = byId.get(id);
    if (!existing || seed.answer.length > existing.answer.length) byId.set(id, seed);
  }
  return [...byId.values()];
}

export async function loadDeck(): Promise<Flashcard[]> {
  return mergeDeck(await loadSeeds(), {});
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
      role: s.role,
      difficulty: s.difficulty,
    };
  });
}

/**
 * Maps old card ids to current ones after the deck has been re-cleaned.
 * Consumed by hydrate() so a repaired question does not orphan its progress.
 */
export function legacyIdMap(seeds: FlashcardSeed[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const seed of seeds) {
    const current = cardId(seed);
    for (const old of seed.legacyIds ?? []) {
      if (old !== current) map[old] = current;
    }
  }
  return map;
}

/**
 * One review. Delegates to the SM-2 scheduler so the deck and any other caller
 * share a single definition of what a grade does.
 */
export function gradeCard(prev: CardProgress | undefined, grade: RecallGrade): CardProgress {
  return gradeProgress(prev, grade);
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
  topic?: string,
  role?: CardRole
): Flashcard[] {
  // Role first: drilling 595 banking cards when you are targeting quant is the
  // single biggest thing wrong with the deck as extracted.
  const byRole = role ? cards.filter((c) => c.role === role) : cards;
  const scoped = topic ? byRole.filter((c) => c.section === topic) : byRole;
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
