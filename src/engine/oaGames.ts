/**
 * The market-making game.
 *
 * Deterministic maths rather than generated content: the true value is computed
 * from the same draw shown to the player afterwards, so there is no answer key
 * to get wrong.
 *
 * The probability, Fermi and task-switch drills live in data/aptitudeFirms.ts
 * and components/aptitude/ — this file covers only what those do not.
 */

export function rint(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
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
