import { parseIcs, type CalendarResponse, type IcsOptions } from './ics.ts';

/**
 * Server-side fetch of a Google Calendar iCal feed.
 *
 * Two reasons this can't live in the browser:
 *  1. Google's calendar endpoint sends no CORS headers.
 *  2. The URL is a secret — it never gets shipped to the client bundle.
 */
const ALLOWED_HOSTS = new Set(['calendar.google.com']);
const MAX_BYTES = 4_000_000;
const FETCH_TIMEOUT_MS = 12_000;

export interface CalendarRequest {
  url: string;
  windowStart: string;
  windowEnd: string;
  tzOffsetMinutes: number;
}

export async function fetchCalendar(req: CalendarRequest): Promise<CalendarResponse> {
  const { url, windowStart, windowEnd, tzOffsetMinutes } = req;
  if (!url) return { ok: false, error: 'Missing calendar URL.' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'That is not a valid URL.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Calendar URL must use https.' };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, error: 'Only calendar.google.com feeds are supported.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Quant-OS/1.0 (personal dashboard)' },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, error: `Calendar returned HTTP ${res.status}.` };
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, error: 'Calendar feed is too large.' };
    }
    if (!/BEGIN:VCALENDAR/.test(text)) {
      return { ok: false, error: 'That URL did not return an iCal feed.' };
    }
    const opts: IcsOptions = { windowStart, windowEnd, tzOffsetMinutes };
    return { ok: true, events: parseIcs(text, opts) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Could not reach the calendar (${message}).` };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse the shared query contract used by both the Vercel route and dev middleware. */
export function requestFromQuery(q: Record<string, string | string[] | undefined>): CalendarRequest {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const tz = parseInt(one(q.tz), 10);
  return {
    url: one(q.url),
    windowStart: one(q.from),
    windowEnd: one(q.to),
    tzOffsetMinutes: Number.isFinite(tz) ? tz : 480,
  };
}
