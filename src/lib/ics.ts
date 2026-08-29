/**
 * Minimal iCalendar reader — enough for Google Calendar's "secret address in
 * iCal format". Runs both in the Vercel serverless function and in the Vite dev
 * middleware, so behaviour is identical locally and in production.
 *
 * Deliberately small: VEVENT + RRULE (DAILY/WEEKLY/MONTHLY) + EXDATE + UNTIL/COUNT.
 * That covers the realistic case here — a recurring university timetable.
 */

export interface IcsOptions {
  /** Inclusive window start, yyyy-mm-dd. */
  windowStart: string;
  /** Inclusive window end, yyyy-mm-dd. */
  windowEnd: string;
  /** Minutes offset from UTC for the calendar's timezone (Singapore = 480). */
  tzOffsetMinutes: number;
}

/** A recurring commitment collapsed from the expanded occurrences. */
export interface ParsedCommitment {
  uid: string;
  title: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  days: number[]; // 0=Sun … 6=Sat
  occurrences: number;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MS_DAY = 86400000;

// --------------------------------------------------------------- iCal parsing

function unfold(text: string): string[] {
  // RFC 5545: lines are folded with CRLF followed by a single space or tab.
  return text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
}

interface RawEvent {
  uid: string;
  summary: string;
  start: string; // "YYYYMMDDTHHMMSS" or "YYYYMMDD"
  end: string;
  rrule?: string;
  exdates: string[];
  allDay: boolean;
  utc: boolean;
}

function extractEvents(lines: string[]): RawEvent[] {
  const events: RawEvent[] = [];
  let cur: Partial<RawEvent> | null = null;
  let exdates: string[] = [];

  const flush = () => {
    if (cur && cur.start && cur.end) {
      events.push({
        uid: cur.uid ?? `ev-${events.length}`,
        summary: (cur.summary ?? '(no title)').trim(),
        start: cur.start,
        end: cur.end,
        rrule: cur.rrule,
        exdates,
        allDay: cur.allDay ?? false,
        utc: cur.utc ?? false,
      });
    }
    cur = null;
    exdates = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      flush();
      continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...params] = left.split(';');
    const paramStr = params.join(';');

    switch (name) {
      case 'UID':
        cur.uid = value;
        break;
      case 'SUMMARY':
        cur.summary = value.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';');
        break;
      case 'DTSTART':
        cur.start = value;
        cur.allDay = value.length === 8 || /VALUE=DATE(?!-TIME)/i.test(paramStr);
        cur.utc = /Z$/.test(value);
        break;
      case 'DTEND':
        cur.end = value;
        break;
      case 'RRULE':
        cur.rrule = value;
        break;
      case 'EXDATE':
        exdates.push(value.split(',').map((s) => s.trim())[0]);
        break;
      case 'STATUS':
        if (/CANCELLED/i.test(value)) cur.start = '';
        break;
      default:
        break;
    }
  }
  flush();
  return events;
}

// ------------------------------------------------------------------ date math

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Parse iCal date-time into a Date representing the wall-clock moment in UTC space. */
function parseIcsDate(v: string, tzOffsetMinutes: number): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    // Absolute UTC — shift into the calendar's local wall clock.
    return new Date(
      Date.UTC(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0)) + tzOffsetMinutes * 60000
    );
  }
  return new Date(Date.UTC(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0)));
}

function timeOf(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | string;
  interval: number;
  byday: string[];
  until: Date | null;
  count: number | null;
}

function parseRRule(s: string, tzOffsetMinutes: number): RRule {
  const parts = s.split(';');
  const get = (k: string) => parts.find((p) => p.startsWith(k + '='))?.slice(k.length + 1);
  const untilRaw = get('UNTIL');
  const countRaw = get('COUNT');
  return {
    freq: get('FREQ') ?? 'DAILY',
    interval: Math.max(1, parseInt(get('INTERVAL') ?? '1', 10) || 1),
    byday: (get('BYDAY') ?? '').split(',').filter(Boolean),
    until: untilRaw ? parseIcsDate(untilRaw, tzOffsetMinutes) : null,
    count: countRaw ? parseInt(countRaw, 10) : null,
  };
}

function mondayOfUTC(d: Date): Date {
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysUTC(d, diff);
}

function matches(date: Date, rule: RRule, origin: Date): boolean {
  if (rule.freq === 'DAILY') {
    const diff = Math.round((date.getTime() - origin.getTime()) / MS_DAY);
    return diff % rule.interval === 0;
  }
  if (rule.freq === 'WEEKLY') {
    const weeks = Math.round(
      (mondayOfUTC(date).getTime() - mondayOfUTC(origin).getTime()) / (7 * MS_DAY)
    );
    if (weeks % rule.interval !== 0) return false;
    if (rule.byday.length === 0) return date.getUTCDay() === origin.getUTCDay();
    return rule.byday.includes(DAY_CODES[date.getUTCDay()]);
  }
  if (rule.freq === 'MONTHLY') {
    if (date.getUTCDate() !== origin.getUTCDate()) return false;
    const months =
      (date.getUTCFullYear() - origin.getUTCFullYear()) * 12 +
      (date.getUTCMonth() - origin.getUTCMonth());
    return months % rule.interval === 0;
  }
  if (rule.freq === 'YEARLY') {
    return date.getUTCMonth() === origin.getUTCMonth() && date.getUTCDate() === origin.getUTCDate();
  }
  return false;
}

// ----------------------------------------------------------------- public API

export function parseIcs(text: string, opts: IcsOptions): ParsedCommitment[] {
  const events = extractEvents(unfold(text));
  const winStart = new Date(`${opts.windowStart}T00:00:00Z`);
  const winEnd = new Date(`${opts.windowEnd}T23:59:59Z`);
  const expanded = new Map<string, ParsedCommitment & { dates: Set<string> }>();

  for (const ev of events) {
    const origin = parseIcsDate(ev.start, opts.tzOffsetMinutes);
    if (!origin) continue;
    const endDt = parseIcsDate(ev.end, opts.tzOffsetMinutes);
    if (!endDt) continue;

    const durationMs = Math.max(endDt.getTime() - origin.getTime(), 15 * 60000);
    if (ev.allDay || durationMs >= 22 * 3600000) continue; // skip all-day / multi-day

    const rule = ev.rrule ? parseRRule(ev.rrule, opts.tzOffsetMinutes) : null;
    const exdates = new Set(ev.exdates.map((x) => x.slice(0, 8)));

    let emitted = 0;
    const limit = rule?.count ?? 400;
    const horizon = rule?.until && rule.until < winEnd ? rule.until : winEnd;

    for (let d = origin; d.getTime() <= horizon.getTime() && emitted < limit; d = addDaysUTC(d, 1)) {
      if (d.getTime() < winStart.getTime()) continue;
      if (rule && !matches(d, rule, origin)) continue;
      if (exdates.has(iso(d).replace(/-/g, ''))) continue;
      emitted += 1;

      const start = timeOf(d);
      const endDate = new Date(d.getTime() + durationMs);
      const end = timeOf(endDate);
      const key = `${ev.uid}|${ev.summary}|${start}|${end}`;
      const existing = expanded.get(key);
      if (existing) {
        existing.dates.add(iso(d));
        existing.occurrences += 1;
      } else {
        expanded.set(key, {
          uid: ev.uid,
          title: ev.summary,
          start,
          end,
          days: [],
          occurrences: 1,
          dates: new Set([iso(d)]),
        });
      }
      // A one-off event exists exactly once — don't walk the rest of the window.
      if (!rule) break;
    }
  }

  return [...expanded.values()].map((e) => {
    const days = [...new Set([...e.dates].map((s) => new Date(`${s}T00:00:00Z`).getUTCDay()))].sort();
    return { uid: e.uid, title: e.title, start: e.start, end: e.end, days, occurrences: e.occurrences };
  });
}

/** Shape returned by /api/calendar. */
export interface CalendarResponse {
  ok: boolean;
  error?: string;
  events?: ParsedCommitment[];
}
