import { parseIcs, type IcsOptions, type ParsedAllDay, type ParsedCommitment } from './ics.js';

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
const MAX_FEEDS = 10;

export interface CalendarRequest {
  urls: string[];
  windowStart: string;
  windowEnd: string;
  tzOffsetMinutes: number;
}

/** Result for one subscribed feed — partial failures must not sink the rest. */
export interface FeedResult {
  url: string;
  ok: boolean;
  error?: string;
  events: ParsedCommitment[];
  allDay: ParsedAllDay[];
  tasks: number;
}

export interface MultiCalendarResponse {
  ok: boolean;
  error?: string;
  feeds?: FeedResult[];
  events?: ParsedCommitment[];
  allDay?: ParsedAllDay[];
  /** VTODO items found across feeds — reported, deliberately not imported. */
  tasks?: number;
  /** What was found, so the UI can explain an empty-looking import. */
  stats?: { recurring: number; oneOff: number; allDay: number };
}

/** Single place to build an empty result, so new fields can't be forgotten. */
function feedError(url: string, error: string): FeedResult {
  return { url, ok: false, error, events: [], allDay: [], tasks: 0 };
}

async function fetchOne(url: string, opts: IcsOptions): Promise<FeedResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return feedError(url, 'That is not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    return feedError(url, 'Calendar URL must use https.');
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return feedError(url, 'Only calendar.google.com feeds are supported.');
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
      return feedError(url, `Calendar returned HTTP ${res.status}.`);
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return feedError(url, 'Calendar feed is too large.');
    }
    if (!/BEGIN:VCALENDAR/.test(text)) {
      return feedError(url, 'That URL did not return an iCal feed.');
    }
    const { commitments, allDay, tasks } = parseIcs(text, opts);
    return {
      url,
      ok: true,
      events: commitments.map((c) => ({ ...c, sourceUrl: url })),
      allDay,
      tasks,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return feedError(url, `Could not reach the calendar (${message}).`);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch every subscribed feed in parallel and merge, keeping per-feed status. */
export async function fetchCalendars(req: CalendarRequest): Promise<MultiCalendarResponse> {
  const { urls, windowStart, windowEnd, tzOffsetMinutes } = req;
  const clean = (urls ?? []).map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return { ok: false, error: 'Add at least one calendar link.' };
  if (clean.length > MAX_FEEDS) {
    return { ok: false, error: `At most ${MAX_FEEDS} calendars are supported.` };
  }

  const opts: IcsOptions = { windowStart, windowEnd, tzOffsetMinutes };
  const feeds = await Promise.all(clean.slice(0, MAX_FEEDS).map((u) => fetchOne(u, opts)));

  const events = dedupe(feeds.flatMap((f) => f.events));
  const allDay = dedupeAllDay(feeds.flatMap((f) => f.allDay));
  const anyOk = feeds.some((f) => f.ok);
  return {
    ok: anyOk,
    feeds,
    events,
    allDay,
    tasks: feeds.reduce((a, f) => a + (f.tasks ?? 0), 0),
    stats: {
      recurring: events.filter((e) => e.recurring).length,
      oneOff: events.filter((e) => !e.recurring).length,
      allDay: allDay.length,
    },
    error: anyOk ? undefined : (feeds[0]?.error ?? 'Calendar sync failed.'),
  };
}

function dedupeAllDay(items: ParsedAllDay[]): ParsedAllDay[] {
  const seen = new Map<string, ParsedAllDay>();
  for (const a of items) {
    const prev = seen.get(a.title);
    if (!prev) seen.set(a.title, a);
    else {
      if (a.start < prev.start) prev.start = a.start;
      if (a.end > prev.end) prev.end = a.end;
    }
  }
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** Collapse commitments that appear identically in several feeds. */
function dedupe(events: ParsedCommitment[]): ParsedCommitment[] {
  const seen = new Map<string, ParsedCommitment>();
  for (const e of events) {
    // Only recurring blocks merge, by weekday set. One-offs stay keyed by their
    // exact date: two one-offs sharing a title and time on different days are
    // genuinely different events and must both survive.
    const key = e.recurring
      ? `r|${e.title}|${e.start}|${e.end}`
      : `o|${e.title}|${e.start}|${e.end}|${e.date}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { ...e });
    } else if (prev.recurring && e.recurring) {
      prev.days = [...new Set([...prev.days, ...e.days])].sort();
      prev.occurrences += e.occurrences;
    }
  }
  return [...seen.values()];
}

/** Parse the shared query contract used by both the Vercel route and dev middleware. */
export function requestFromQuery(q: Record<string, string | string[] | undefined>): CalendarRequest {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const tz = parseInt(one(q.tz), 10);
  // Accept repeated ?url= params; a comma-separated single value also works.
  const urls = many(q.url).flatMap((u) => u.split(',').map((s) => s.trim())).filter(Boolean);
  return {
    urls,
    windowStart: one(q.from),
    windowEnd: one(q.to),
    tzOffsetMinutes: Number.isFinite(tz) ? tz : 480,
  };
}
