import type { Prediction, PredictionDirection } from '../models';
import { daysBetween, today } from '../lib/date';

/**
 * Scoring for market-view predictions.
 *
 * The journal already asked "what do you think happens next" and nothing ever
 * checked. A prediction with a direction, a horizon and the price at the time
 * can be resolved automatically and scored for calibration — which is the
 * difference between keeping a diary and actually finding out whether you can
 * read a market.
 */

export function directionOf(changePct: number, flatBandPct: number): PredictionDirection {
  if (Math.abs(changePct) < flatBandPct) return 'flat';
  return changePct > 0 ? 'up' : 'down';
}

export function isDue(p: Prediction, date = today()): boolean {
  return !p.resolvedAt && daysBetween(p.resolveDate, date) >= 0;
}

/** Resolves one prediction against the current price. */
export function resolve(p: Prediction, endPrice: number, date = today()): Prediction {
  const actualChangePct = ((endPrice - p.startPrice) / p.startPrice) * 100;
  const actual = directionOf(actualChangePct, p.flatBandPct);
  return {
    ...p,
    resolvedAt: date,
    endPrice,
    actualChangePct,
    correct: actual === p.direction,
  };
}

export interface Calibration {
  resolved: number;
  correct: number;
  accuracy: number;
  /**
   * Brier score over the stated confidence: mean squared error between the
   * probability you claimed and what happened. Lower is better; 0.25 is what
   * you get by always saying 50%.
   */
  brier: number | null;
  /** Accuracy within each confidence bucket — where overconfidence shows up. */
  buckets: { label: string; stated: number; actual: number; n: number }[];
}

const BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: '50-60%', lo: 0.5, hi: 0.6 },
  { label: '60-70%', lo: 0.6, hi: 0.7 },
  { label: '70-80%', lo: 0.7, hi: 0.8 },
  { label: '80-90%', lo: 0.8, hi: 0.9 },
  { label: '90-100%', lo: 0.9, hi: 1.01 },
];

export function calibration(predictions: Prediction[]): Calibration {
  const resolved = predictions.filter((p) => p.resolvedAt && p.correct !== undefined);
  const correct = resolved.filter((p) => p.correct).length;

  const brier = resolved.length
    ? resolved.reduce((acc, p) => acc + (p.confidence - (p.correct ? 1 : 0)) ** 2, 0) / resolved.length
    : null;

  const buckets = BUCKETS.map((b) => {
    const inBucket = resolved.filter((p) => p.confidence >= b.lo && p.confidence < b.hi);
    return {
      label: b.label,
      stated: inBucket.length
        ? inBucket.reduce((a, p) => a + p.confidence, 0) / inBucket.length
        : (b.lo + b.hi) / 2,
      actual: inBucket.length ? inBucket.filter((p) => p.correct).length / inBucket.length : 0,
      n: inBucket.length,
    };
  }).filter((b) => b.n > 0);

  return {
    resolved: resolved.length,
    correct,
    accuracy: resolved.length ? correct / resolved.length : 0,
    brier,
    buckets,
  };
}

/**
 * A one-line read on calibration, since a Brier score means nothing on its own.
 * Only offered once there is enough history to be worth saying.
 */
export function calibrationNote(c: Calibration): string | null {
  if (c.resolved < 5) return null;
  const overconfident = c.buckets.filter((b) => b.stated - b.actual > 0.15);
  if (overconfident.length > 0) {
    return `You are overconfident in the ${overconfident.map((b) => b.label).join(', ')} band — stated confidence is running well above your hit rate.`;
  }
  if (c.brier !== null && c.brier > 0.25) {
    return 'Your Brier score is worse than always saying 50% — the confidence numbers are not carrying information yet.';
  }
  if (c.accuracy > 0.6 && c.resolved >= 10) {
    return 'Above 60% over a real sample. Worth checking whether it holds across asset classes or comes from one trade.';
  }
  return null;
}
