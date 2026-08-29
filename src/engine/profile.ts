import type { AppState, PillarId } from '../models';
import { mondayOf, addDays } from '../lib/date';

// Weekly progress: completed tasks this week / total tasks this week.
export function weeklyProgress(state: AppState, dateISO: string): number {
  const mon = mondayOf(dateISO);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const weekTasks = state.tasks.filter((t) => days.includes(t.date));
  if (weekTasks.length === 0) return 0;
  const done = weekTasks.filter((t) => t.status === 'done').length;
  return Math.round((done / weekTasks.length) * 100);
}

// Minutes invested per pillar over the trailing `days` window (from completed tasks).
export function pillarMinutes(state: AppState, dateISO: string, days = 7): Record<PillarId, number> {
  const start = addDays(dateISO, -days + 1);
  const acc: Record<string, number> = {
    academics: 0, programming: 0, ai: 0, finance: 0, research: 0, career: 0,
  };
  for (const t of state.tasks) {
    if (t.status === 'done' && t.date >= start && t.date <= dateISO) {
      acc[t.pillar] += t.minutes;
    }
  }
  return acc as Record<PillarId, number>;
}

// Investment ratio vs target (0 = none, 1 = on target, >1 over-invested).
export function investmentRatios(state: AppState, dateISO: string): Record<PillarId, number> {
  const mins = pillarMinutes(state, dateISO, 7);
  const out: Record<string, number> = {};
  for (const p of state.pillars) {
    const targetMin = p.targetHoursPerWeek * 60;
    out[p.id] = targetMin > 0 ? mins[p.id] / targetMin : 0;
  }
  return out as Record<PillarId, number>;
}

// The most neglected pillar = lowest (score-weighted) investment ratio.
export function neglectedPillar(state: AppState, dateISO: string): {
  pillar: PillarId;
  ratio: number;
  extraHours: number;
} {
  const ratios = investmentRatios(state, dateISO);
  let worst: PillarId = 'research';
  let worstScore = Infinity;
  for (const p of state.pillars) {
    // Combine low weekly investment AND low capability score.
    const combined = ratios[p.id] * 0.6 + (p.score / 100) * 0.4;
    if (combined < worstScore) {
      worstScore = combined;
      worst = p.id;
    }
  }
  const p = state.pillars.find((x) => x.id === worst)!;
  const deficitMin = Math.max(0, p.targetHoursPerWeek * 60 - pillarMinutes(state, dateISO, 7)[worst]);
  return { pillar: worst, ratio: ratios[worst], extraHours: Math.round((deficitMin / 60) * 2) / 2 };
}

// Completion rate over the trailing window (for adaptive difficulty).
export function recentCompletionRate(state: AppState, dateISO: string, days = 7): number {
  const start = addDays(dateISO, -days);
  const past = state.tasks.filter((t) => t.date >= start && t.date < dateISO);
  if (past.length === 0) return 1;
  const done = past.filter((t) => t.status === 'done').length;
  return done / past.length;
}

export function currentStreak(state: AppState, dateISO: string): number {
  let streak = 0;
  let cursor = dateISO;
  for (let i = 0; i < 400; i++) {
    const dayTasks = state.tasks.filter((t) => t.date === cursor && t.priority === 'core');
    const done = dayTasks.filter((t) => t.status === 'done');
    if (dayTasks.length > 0 && done.length >= 1) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (cursor === dateISO) {
      // today may be incomplete; skip without breaking streak
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}
