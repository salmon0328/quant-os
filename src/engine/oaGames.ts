/**
 * Procedural generators for the OA Lab.
 *
 * Everything here is deterministic maths rather than generated content: an
 * expected-value question whose answer is computed from the same numbers shown
 * to the user cannot have a wrong answer key, which is exactly the failure the
 * generated quiz banks needed a verification pass to catch.
 */

export function rint(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

function round(n: number, dp = 4): number {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

// ---------------------------------------------------------------- EV round

export type EvCategory = 'dice' | 'coins' | 'cards' | 'conditional' | 'combinatorics' | 'games';

export interface EvQuestion {
  category: EvCategory;
  text: string;
  answer: number;
  /** Accepted absolute error. */
  tolerance: number;
  working: string;
}

const SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];

/** One expected-value or probability question, with its answer derived, not stored. */
export function evQuestion(): EvQuestion {
  const kind = pick<EvCategory>(['dice', 'coins', 'cards', 'conditional', 'combinatorics', 'games']);

  if (kind === 'dice') {
    const n = rint(2, 4);
    const faces = pick([4, 6, 8, 10, 20]);
    const mean = (faces + 1) / 2;
    return {
      category: 'dice',
      text: `You roll ${n} fair ${faces}-sided dice. What is the expected value of the sum?`,
      answer: round(n * mean),
      tolerance: 0.01,
      working: `Each die has mean (1+${faces})/2 = ${mean}. By linearity of expectation, ${n} × ${mean} = ${n * mean}.`,
    };
  }

  if (kind === 'coins') {
    const n = rint(4, 12);
    const want = rint(1, Math.min(3, n - 1));
    // P(exactly `want` heads) = C(n, want) / 2^n
    const c = choose(n, want);
    return {
      category: 'coins',
      text: `You flip ${n} fair coins. What is the probability of getting exactly ${want} head${want === 1 ? '' : 's'}? (as a decimal)`,
      answer: round(c / 2 ** n, 5),
      tolerance: 0.002,
      working: `C(${n},${want}) / 2^${n} = ${c} / ${2 ** n} = ${round(c / 2 ** n, 5)}.`,
    };
  }

  if (kind === 'cards') {
    const suit = pick(SUITS);
    const n = rint(2, 4);
    // P(all n drawn cards are the chosen suit), without replacement.
    let p = 1;
    for (let i = 0; i < n; i++) p *= (13 - i) / (52 - i);
    return {
      category: 'cards',
      text: `You draw ${n} cards from a standard 52-card deck without replacement. What is the probability all ${n} are ${suit}? (as a decimal)`,
      answer: round(p, 5),
      tolerance: 0.0015,
      working: `${Array.from({ length: n }, (_, i) => `${13 - i}/${52 - i}`).join(' × ')} = ${round(p, 5)}.`,
    };
  }

  if (kind === 'conditional') {
    // Classic base-rate question: a test with known sensitivity and specificity.
    const prevalence = pick([0.01, 0.02, 0.05, 0.1]);
    const sens = pick([0.9, 0.95, 0.99]);
    const spec = pick([0.9, 0.95, 0.99]);
    const truePos = prevalence * sens;
    const falsePos = (1 - prevalence) * (1 - spec);
    const posterior = truePos / (truePos + falsePos);
    return {
      category: 'conditional',
      text: `A disease affects ${(prevalence * 100).toFixed(0)}% of a population. A test detects it ${(sens * 100).toFixed(0)}% of the time when present, and is correct ${(spec * 100).toFixed(0)}% of the time when it is absent. Given a positive test, what is the probability the person has the disease? (as a decimal)`,
      answer: round(posterior, 4),
      tolerance: 0.01,
      working: `P = (${prevalence}×${sens}) / (${prevalence}×${sens} + ${round(1 - prevalence, 3)}×${round(1 - spec, 3)}) = ${round(posterior, 4)}.`,
    };
  }

  if (kind === 'combinatorics') {
    const n = rint(5, 10);
    const k = rint(2, Math.min(4, n - 1));
    return {
      category: 'combinatorics',
      text: `How many ways can you choose ${k} items from ${n} distinct items, order not mattering?`,
      answer: choose(n, k),
      tolerance: 0,
      working: `C(${n},${k}) = ${n}! / (${k}!·${n - k}!) = ${choose(n, k)}.`,
    };
  }

  // Fair-value-of-a-game question — the shape a trading interview actually uses.
  const faces = pick([6, 8, 10]);
  const rerolls = pick([1, 2]);
  // Optimal stopping over `rerolls` extra rolls of a fair die.
  let value = (faces + 1) / 2;
  for (let r = 0; r < rerolls; r++) {
    let sum = 0;
    for (let f = 1; f <= faces; f++) sum += Math.max(f, value);
    value = sum / faces;
  }
  return {
    category: 'games',
    text: `You roll a fair ${faces}-sided die. You may reroll up to ${rerolls} more time${rerolls === 1 ? '' : 's'}, keeping the final roll you stop on, and you play optimally. What is the fair value of the game?`,
    answer: round(value, 4),
    tolerance: 0.05,
    working: `Work backwards: the last roll is worth ${(faces + 1) / 2}. At each earlier stage, stop when the roll beats the continuation value. Value = ${round(value, 4)}.`,
  };
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

// ------------------------------------------------------- market making game

export type MakingRound = {
  /** What the true value is derived from, shown after the round. */
  description: string;
  trueValue: number;
  /** What the player knows before quoting. */
  prompt: string;
};

/**
 * A market-making round. The player quotes a two-sided market on a random
 * variable they can reason about but not observe; a simulated counterparty
 * trades only when the quote is wrong in their favour.
 */
export function makingRound(): MakingRound {
  const kind = pick(['dice3', 'cards', 'coins', 'birthday'] as const);

  if (kind === 'dice3') {
    const rolls = Array.from({ length: 3 }, () => rint(1, 6));
    return {
      description: `Three dice rolled ${rolls.join(', ')} — sum ${rolls.reduce((a, b) => a + b, 0)}.`,
      trueValue: rolls.reduce((a, b) => a + b, 0),
      prompt: 'the sum of three fair six-sided dice',
    };
  }

  if (kind === 'cards') {
    const n = rint(3, 5);
    const cards = Array.from({ length: n }, () => rint(1, 13));
    return {
      description: `Cards drawn: ${cards.join(', ')} — total ${cards.reduce((a, b) => a + b, 0)}.`,
      trueValue: cards.reduce((a, b) => a + b, 0),
      prompt: `the sum of ${n} cards drawn from a deck (ace = 1, king = 13)`,
    };
  }

  if (kind === 'coins') {
    const n = pick([20, 50, 100]);
    const heads = Array.from({ length: n }, () => rint(0, 1)).reduce((a: number, b) => a + b, 0);
    return {
      description: `${heads} heads out of ${n}.`,
      trueValue: heads,
      prompt: `the number of heads in ${n} fair coin flips`,
    };
  }

  const people = rint(20, 40);
  // Expected number of distinct birthdays among `people`, 365 days.
  const expected = 365 * (1 - (1 - 1 / 365) ** people);
  const actual = Math.round(expected + (Math.random() - 0.5) * 4);
  return {
    description: `Distinct birthdays: ${actual} (expectation ≈ ${expected.toFixed(1)}).`,
    trueValue: actual,
    prompt: `the number of distinct birthdays among ${people} random people`,
  };
}

export interface MakingResult {
  /** 'buy' means the counterparty lifted your offer; 'sell' means they hit your bid. */
  action: 'buy' | 'sell' | 'none';
  /** Your P&L on the round, in units of the underlying. */
  pnl: number;
  note: string;
}

/**
 * Settles one round.
 *
 * The counterparty is not random: it trades only when your quote is wrong,
 * which is what makes a wide market safe and a tight wrong market expensive.
 * That asymmetry is the entire lesson of the exercise.
 */
export function settleMaking(bid: number, ask: number, trueValue: number): MakingResult {
  if (ask <= bid) {
    return { action: 'none', pnl: 0, note: 'Your ask must be above your bid — that is a crossed market.' };
  }

  if (trueValue > ask) {
    // Your offer is too low: they buy from you, and you are short below fair.
    return {
      action: 'buy',
      pnl: ask - trueValue,
      note: `They lifted your offer at ${ask}. Fair was ${trueValue}, so you sold ${(trueValue - ask).toFixed(1)} too cheap.`,
    };
  }
  if (trueValue < bid) {
    return {
      action: 'sell',
      pnl: trueValue - bid,
      note: `They hit your bid at ${bid}. Fair was ${trueValue}, so you paid ${(bid - trueValue).toFixed(1)} too much.`,
    };
  }
  return {
    action: 'none',
    pnl: 0,
    note: `Fair was ${trueValue}, inside your ${bid} / ${ask} market. No trade — your quote was good.`,
  };
}

/** How tight a market you could have quoted and still not been picked off. */
export function idealSpread(trueValue: number, bid: number, ask: number): string {
  const width = ask - bid;
  const mid = (bid + ask) / 2;
  const skew = mid - trueValue;
  if (Math.abs(skew) > width / 2) return `Your mid was ${skew > 0 ? 'above' : 'below'} fair by ${Math.abs(skew).toFixed(1)} — width would not have saved you.`;
  return `Width ${width.toFixed(1)}, mid off fair by ${Math.abs(skew).toFixed(1)}.`;
}

// -------------------------------------------------------------- zap / grid

export interface ZapRound {
  grid: number[];
  /** Index the player must click. */
  targetIndex: number;
  instruction: string;
}

/** Optiver-style timed grid: find a value under time pressure. */
export function zapRound(size = 16): ZapRound {
  const grid = Array.from({ length: size }, () => rint(10, 99));
  const mode = pick(['max', 'min', 'closest'] as const);

  if (mode === 'max') {
    const target = grid.indexOf(Math.max(...grid));
    return { grid, targetIndex: target, instruction: 'Click the LARGEST number' };
  }
  if (mode === 'min') {
    const target = grid.indexOf(Math.min(...grid));
    return { grid, targetIndex: target, instruction: 'Click the SMALLEST number' };
  }
  const anchor = rint(20, 90);
  let best = 0;
  grid.forEach((v, i) => {
    if (Math.abs(v - anchor) < Math.abs(grid[best] - anchor)) best = i;
  });
  return { grid, targetIndex: best, instruction: `Click the number CLOSEST to ${anchor}` };
}
