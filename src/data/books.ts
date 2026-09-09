import type { BookProgress } from '../models';
import { READING_BY_BOOK, type ReadingUnit } from './tracks/reading';

/**
 * The reading shelf.
 *
 * Replaces the Resource Library, which was 33 homepage links with a 0-100
 * slider. Books are the thing actually being worked through, so they get
 * chapter-level tracking, a place for your own copy, and a link into the
 * planner's reading rotation.
 *
 * Chapters are NOT duplicated here — they live in data/tracks/reading.ts, which
 * is what the planner walks, so the two cannot drift apart. `hasChapters`
 * reports whether a book is in that rotation.
 */

export type BookCategory =
  | 'derivatives'
  | 'volatility'
  | 'fixed-income'
  | 'macro'
  | 'microstructure'
  | 'machine-learning'
  | 'narrative';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  /** 1 = read this first, 3 = when you have time. */
  priority: 1 | 2 | 3;
  why: string;
  whenToRead: string;
  estHours: number;
  /** Roughly, for books tracked by percentage rather than chapter. */
  pages?: number;
  /** Publisher or author's own page — never a pirated copy. */
  publisherUrl?: string;
  /** Only for books with a genuinely free, legal full text. */
  freeUrl?: string;
  /** Anything the shelf should say plainly, e.g. an edition caveat. */
  note?: string;
}

export const BOOK_CATEGORY_LABEL: Record<BookCategory, string> = {
  derivatives: 'Derivatives',
  volatility: 'Volatility',
  'fixed-income': 'Fixed income',
  macro: 'Macro & global economy',
  microstructure: 'Microstructure & execution',
  'machine-learning': 'Machine learning',
  narrative: 'Narrative & market feel',
};

export const BOOKS: Book[] = [
  // ------------------------------------------------------------ derivatives
  {
    id: 'hull',
    title: 'Options, Futures and Other Derivatives',
    author: 'John C. Hull',
    category: 'derivatives',
    priority: 1,
    why: 'The canonical derivatives text. Every trading intern gets handed this, and interviewers assume it.',
    whenToRead: 'First. Chapters 1-20 cover almost everything an internship interview asks about.',
    estHours: 60,
    publisherUrl: 'https://www-2.rotman.utoronto.ca/~hull/ofod/index.html',
    note: 'Chapter numbering follows the 11th edition.',
  },
  {
    id: 'natenberg',
    title: 'Option Volatility and Pricing',
    author: 'Sheldon Natenberg',
    category: 'volatility',
    priority: 1,
    why: 'The "green vol book" — how options behave in practice rather than in the model. Standard issue for vol interns.',
    whenToRead: 'Alongside Hull chapters 10-20. Natenberg gives the trader intuition Hull gives the maths for.',
    estHours: 45,
    publisherUrl: 'https://www.mheducation.com/highered/product/option-volatility-pricing-advanced-trading-strategies-techniques-natenberg/9780071818773.html',
    note: '2nd edition.',
  },
  {
    id: 'taleb',
    title: 'Dynamic Hedging',
    author: 'Nassim Nicholas Taleb',
    category: 'volatility',
    priority: 2,
    why: 'What actually happens to a hedged book when the model assumptions fail. Dense, opinionated, and the real thing.',
    whenToRead: 'After Natenberg. It assumes you already know the greeks cold.',
    estHours: 40,
    publisherUrl: 'https://www.wiley.com/en-us/Dynamic+Hedging%3A+Managing+Vanilla+and+Exotic+Options-p-9780471152804',
    note: 'Chapter groupings in the reading rotation are approximate — check against your copy.',
  },

  // ----------------------------------------------------------- fixed income
  {
    id: 'jha',
    title: 'Interest Rate Markets: A Practical Approach to Fixed Income',
    author: 'Siddhartha Jha',
    category: 'fixed-income',
    priority: 1,
    why: 'The most practical bridge from rates theory to how a rates desk actually thinks about trades.',
    whenToRead: 'Once you are comfortable with Hull chapters 4-7.',
    estHours: 30,
    pages: 320,
    publisherUrl: 'https://www.wiley.com/en-us/Interest+Rate+Markets%3A+A+Practical+Approach+to+Fixed+Income-p-9780470932209',
  },
  {
    id: 'treasury-basis',
    title: 'The Treasury Bond Basis',
    author: 'Burghardt, Belton, Lane & Papa',
    category: 'fixed-income',
    priority: 2,
    why: 'The "bond bible" on macro desks — cheapest-to-deliver, the basis trade, and futures mechanics done properly.',
    whenToRead: 'After Jha, when futures and repo have started appearing in your reading.',
    estHours: 25,
    pages: 320,
    publisherUrl: 'https://www.mhprofessional.com/the-treasury-bond-basis-an-in-depth-analysis-for-hedgers-speculators-and-arbitrageurs-9780071456104-usa',
  },
  {
    id: 'tuckman',
    title: 'Fixed Income Securities',
    author: 'Bruce Tuckman & Angel Serrat',
    category: 'fixed-income',
    priority: 2,
    why: 'The academic backbone for rates: discount factors, term structure, DV01, key-rate exposures.',
    whenToRead: 'As a reference alongside Jha rather than cover to cover.',
    estHours: 40,
    pages: 620,
    publisherUrl: 'https://www.wiley.com/en-us/Fixed+Income+Securities%3A+Tools+for+Today%27s+Markets%2C+4th+Edition-p-9781119835554',
  },

  // ------------------------------------------------------------------ macro
  {
    id: 'gliner',
    title: 'Global Macro Trading',
    author: 'Greg Gliner',
    category: 'macro',
    priority: 2,
    why: 'How macro traders actually express a view across rates, FX, equities and commodities.',
    whenToRead: 'Once you can read a yield curve and have started journalling market moves.',
    estHours: 25,
    pages: 400,
    publisherUrl: 'https://www.wiley.com/en-us/Global+Macro+Trading%3A+Profiting+in+a+New+World+Economy-p-9781118242698',
  },
  {
    id: 'cleaver',
    title: 'Understanding the World Economy',
    author: 'Tony Cleaver',
    category: 'macro',
    priority: 3,
    why: 'Fills in the economics background that macro reading assumes you already have.',
    whenToRead: 'Background reading — dip into the chapters that cover gaps you notice.',
    estHours: 20,
    pages: 320,
    publisherUrl: 'https://www.routledge.com/Understanding-the-World-Economy/Cleaver/p/book/9780415583374',
  },
  {
    id: 'value-chains',
    title: 'Harnessing Global Value Chains for Regional Development',
    author: 'Riccardo Crescenzi & Oliver Harman',
    category: 'macro',
    priority: 3,
    why: 'Supply chains as an economic mechanism — useful context for trade, inflation and commodity narratives.',
    whenToRead: 'Optional depth. Read after the core macro titles.',
    estHours: 12,
    pages: 200,
    publisherUrl: 'https://www.routledge.com/Harnessing-Global-Value-Chains-for-regional-development-How-to-upgrade-through-regional-policy-FDI-and-trade/Crescenzi-Harman/p/book/9781032056678',
    freeUrl: 'https://library.oapen.org/handle/20.500.12657/50795',
    note: 'Open access — a legal full text is genuinely free.',
  },

  // -------------------------------------------------- microstructure & quant
  {
    id: 'algo-dma',
    title: 'Algorithmic Trading and DMA',
    author: 'Barry Johnson',
    category: 'microstructure',
    priority: 2,
    why: 'The reference on execution: order types, market impact, and how algos actually work.',
    whenToRead: 'When you start caring how a trade gets filled, not just whether it is a good idea.',
    estHours: 35,
    pages: 570,
    publisherUrl: 'https://www.algo-dma.com/',
  },
  {
    id: 'quant-macro',
    title: 'Quantitative Macro Trading',
    author: 'Johnson',
    category: 'macro',
    priority: 3,
    why: 'Systematic approaches to macro views.',
    whenToRead: 'After Gliner, if systematic macro is the direction you want.',
    estHours: 25,
    note: 'Check the exact title/author against your copy — this one is easy to confuse with Barry Johnson’s execution book.',
  },
  {
    id: 'afml',
    title: 'Advances in Financial Machine Learning',
    author: 'Marcos López de Prado',
    category: 'machine-learning',
    priority: 2,
    why: 'The rigorous treatment of why standard ML leaks in finance: labelling, purged CV, backtest overfitting.',
    whenToRead: 'Once you have built a model and want to know why your backtest is lying to you.',
    estHours: 35,
    pages: 400,
    publisherUrl: 'https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482086',
  },
  {
    id: 'sutton-barto',
    title: 'Reinforcement Learning: An Introduction',
    author: 'Richard S. Sutton & Andrew G. Barto',
    category: 'machine-learning',
    priority: 3,
    why: 'The RL standard, and directly relevant to the agent work already on your CV.',
    whenToRead: 'When the AI pillar comes round in the roadmap.',
    estHours: 40,
    freeUrl: 'http://incompleteideas.net/book/the-book-2nd.html',
    note: 'The authors publish the full PDF free.',
  },

  // -------------------------------------------------------------- narrative
  {
    id: 'trading-game',
    title: 'The Trading Game',
    author: 'Gary Stevenson',
    category: 'narrative',
    priority: 1,
    why: 'What a rates trading floor is actually like, from someone who was on one recently.',
    whenToRead: 'Any time. Short, and the closest thing to a preview of the job.',
    estHours: 8,
    pages: 340,
    publisherUrl: 'https://www.penguin.co.uk/books/451825/the-trading-game-by-stevenson-gary/9780241636602',
  },
  {
    id: 'liars-poker',
    title: "Liar's Poker",
    author: 'Michael Lewis',
    category: 'narrative',
    priority: 2,
    why: 'The origin story of the modern bond desk, and still the best explanation of why sales and trading are different jobs.',
    whenToRead: 'Any time.',
    estHours: 7,
    pages: 310,
    publisherUrl: 'https://wwnorton.com/books/9780393338690',
  },
  {
    id: 'big-short',
    title: 'The Big Short',
    author: 'Michael Lewis',
    category: 'narrative',
    priority: 2,
    why: 'How a structured-credit blow-up actually happened — useful context for Hull chapter 8.',
    whenToRead: 'Alongside Hull chapters 8 and 24-25.',
    estHours: 7,
    pages: 290,
    publisherUrl: 'https://wwnorton.com/books/9780393338829',
  },
  {
    id: 'house-of-money',
    title: 'Inside the House of Money',
    author: 'Steven Drobny',
    category: 'narrative',
    priority: 2,
    why: 'Interviews with global macro managers on how they actually form and size a view.',
    whenToRead: 'With or after Gliner.',
    estHours: 12,
    pages: 400,
    publisherUrl: 'https://www.wiley.com/en-us/Inside+the+House+of+Money%3A+Top+Hedge+Fund+Traders+on+Profiting+in+the+Global+Markets-p-9780470279878',
  },
  {
    id: 'the-fund',
    title: 'The Fund',
    author: 'Rob Copeland',
    category: 'narrative',
    priority: 3,
    why: 'Bridgewater from the inside — a useful corrective to how funds present themselves.',
    whenToRead: 'Any time.',
    estHours: 9,
    pages: 350,
    publisherUrl: 'https://us.macmillan.com/books/9781250276933/thefund',
  },
  {
    id: 'black-swan',
    title: 'The Black Swan',
    author: 'Nassim Nicholas Taleb',
    category: 'narrative',
    priority: 3,
    why: 'The argument about tail risk that sits underneath Dynamic Hedging.',
    whenToRead: 'Before or alongside Dynamic Hedging.',
    estHours: 12,
    pages: 400,
    publisherUrl: 'https://www.penguinrandomhouse.com/books/176226/the-black-swan-second-edition-by-nassim-nicholas-taleb/',
  },
];

export const BOOK_BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

/** Chapters come from the planner's reading rotation, so the two cannot drift. */
export function chaptersOf(bookId: string): ReadingUnit[] {
  return READING_BY_BOOK[bookId] ?? [];
}

export function hasChapters(bookId: string): boolean {
  return chaptersOf(bookId).length > 0;
}

export const EMPTY_BOOK_PROGRESS: BookProgress = { status: 'unread', chaptersDone: [] };

/** 0-100. Chapter-tracked books count chapters; the rest fall back to pages. */
export function percentDone(book: Book, progress: BookProgress | undefined): number {
  if (!progress) return 0;
  if (progress.status === 'finished') return 100;
  const chapters = chaptersOf(book.id);
  if (chapters.length > 0) {
    return Math.round((progress.chaptersDone.length / chapters.length) * 100);
  }
  if (book.pages && progress.currentPage) {
    return Math.min(100, Math.round((progress.currentPage / book.pages) * 100));
  }
  return progress.status === 'reading' ? 5 : 0;
}

/** Play Books reader deep link for a volume the user uploaded themselves. */
export function playBooksUrl(volumeId: string): string {
  return `https://play.google.com/books/reader?id=${encodeURIComponent(volumeId)}`;
}
