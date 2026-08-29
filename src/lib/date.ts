// Date helpers (all dates handled as local yyyy-mm-dd strings).

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toISO(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function dayOfWeek(s: string): number {
  return parseISO(s).getDay(); // 0 Sun ... 6 Sat
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function mondayOf(s: string): string {
  const dow = dayOfWeek(s);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(s, diff);
}

// Global program week index (1-based) given a start date.
export function weekIndexFrom(startISO: string, currentISO: string): number {
  const startMon = mondayOf(startISO);
  const curMon = mondayOf(currentISO);
  return Math.floor(daysBetween(startMon, curMon) / 7) + 1;
}

export function monthIndexFrom(weekIndex: number): number {
  return Math.floor((weekIndex - 1) / 4) + 1;
}

export function formatLong(s: string): string {
  const d = parseISO(s);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Deterministic pseudo-random from a string seed (mulberry32).
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
