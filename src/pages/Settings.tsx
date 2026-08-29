import { useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Field, Chip, EmptyState } from '../components/ui';
import { WEEKDAY_NAMES, today } from '../lib/date';
import { uid } from '../lib/id';
import type { CalendarFeed, FixedBlock, TaskLocation } from '../models';
import { freeSlots, blocksForDate, isCampusDay } from '../engine/scheduler';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { state, updateSchedule, syncCalendar, addFixedBlock, updateFixedBlock, removeFixedBlock } = useApp();
  const s = state.schedule;
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [allDay, setAllDay] = useState<{ title: string; start: string; end: string }[]>([]);
  const [syncInfo, setSyncInfo] = useState<{
    tasks: number;
    stats?: { recurring: number; oneOff: number; allDay: number };
  }>({ tasks: 0 });
  const [editing, setEditing] = useState<FixedBlock | null>(null);

  const preview = freeSlots(state.fixedBlocks, s, today());
  const onCampus = isCampusDay(s, today());

  const runSync = async () => {
    setSyncing(true);
    setMsg(null);
    const res = await syncCalendar();
    setSyncing(false);
    if (!res.ok) {
      setMsg({ tone: 'err', text: res.error ?? 'Sync failed.' });
    } else if (res.failed) {
      setMsg({ tone: 'warn', text: `Imported ${res.imported ?? 0} commitments, but ${res.error ?? ''}` });
    } else {
      const st = res.stats;
      const parts = st
        ? `${st.recurring} weekly, ${st.oneOff} one-off`
        : `${res.imported ?? 0} commitments`;
      setMsg({ tone: 'ok', text: `Imported ${parts} from ${s.icsFeeds.length} calendar(s).` });
    }
    setAllDay(res.allDay ?? []);
    setSyncInfo({ tasks: res.tasks ?? 0, stats: res.stats });
  };

  const setFeeds = (feeds: CalendarFeed[]) => updateSchedule({ icsFeeds: feeds });
  const addFeed = () => setFeeds([...s.icsFeeds, { id: uid('feed-'), label: '', url: '' }]);
  const updateFeed = (id: string, patch: Partial<CalendarFeed>) =>
    setFeeds(s.icsFeeds.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFeed = (id: string) => setFeeds(s.icsFeeds.filter((f) => f.id !== id));

  const toggleDay = (d: number) => {
    const next = s.campusDays.includes(d)
      ? s.campusDays.filter((x) => x !== d)
      : [...s.campusDays, d].sort();
    updateSchedule({ campusDays: next });
  };

  const icsCount = state.fixedBlocks.filter((b) => b.source === 'ics').length;
  const manualCount = state.fixedBlocks.length - icsCount;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-400">Your rhythm, your calendar, and how much the day is allowed to ask of you.</p>
      </div>

      {/* ---------------------------------------------------------- rhythm */}
      <Card>
        <SectionTitle>Working hours</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Earliest you're up">
            <input type="time" className="input" value={s.wakeTime} onChange={(e) => updateSchedule({ wakeTime: e.target.value })} />
          </Field>
          <Field label="Latest you'll work">
            <input type="time" className="input" value={s.sleepTime} onChange={(e) => updateSchedule({ sleepTime: e.target.value })} />
          </Field>
          <Field label="Buffer between blocks (min)">
            <input
              type="number" min={0} max={60} className="input"
              value={s.bufferMinutes}
              onChange={(e) => updateSchedule({ bufferMinutes: Math.max(0, Math.min(60, +e.target.value)) })}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          A sleep time earlier than your wake time is treated as after midnight (e.g. wake 06:00, sleep 01:00 = a 19-hour window).
        </p>
      </Card>

      {/* ---------------------------------------------------- task budgets */}
      <Card>
        <SectionTitle>How much the day asks of you</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Max core tasks / day">
            <select className="input" value={s.maxCoreTasks} onChange={(e) => updateSchedule({ maxCoreTasks: +e.target.value })}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Max optional tasks / day">
            <select className="input" value={s.maxOptionalTasks} onChange={(e) => updateSchedule({ maxOptionalTasks: +e.target.value })}>
              {[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Auto-assign start times">
            <select className="input" value={s.autoSchedule ? 'yes' : 'no'} onChange={(e) => updateSchedule({ autoSchedule: e.target.value === 'yes' })}>
              <option value="yes">Yes — place tasks in free slots</option>
              <option value="no">No — just list them</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Core tasks are the ones that count. Optional tasks are bonus — skipping them is not a failure.
        </p>
      </Card>

      {/* ------------------------------------------------------- on campus */}
      <Card>
        <SectionTitle right={<span className={`text-xs ${onCampus ? 'text-emerald-500' : 'text-slate-400'}`}>{onCampus ? 'Today is a campus day' : 'Not a campus day'}</span>}>
          Days you're on campus
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {DAY_SHORT.map((d, i) => (
            <button key={d} onClick={() => toggleDay(i)} className={`chip ${s.campusDays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {d}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Bloomberg terminal tasks only appear on these days — no point scheduling work you can't physically do.
        </p>
      </Card>

      {/* -------------------------------------------------------- calendar */}
      <Card>
        <SectionTitle right={<span className="text-xs text-slate-400">{icsCount} imported · {manualCount} manual</span>}>
          Google Calendar ({s.icsFeeds.length} subscribed)
        </SectionTitle>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
          <li>Open <b>Google Calendar → Settings → [each calendar] → Integrate calendar</b>.</li>
          <li>Copy the <b>“Secret address in iCal format”</b> (or the public one).</li>
          <li>Add one row per calendar below, then press Import.</li>
        </ol>

        <div className="space-y-2">
          {s.icsFeeds.length === 0 && (
            <p className="text-xs text-slate-400">No calendars yet — add your first one.</p>
          )}
          {s.icsFeeds.map((f) => (
            <div key={f.id} className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input sm:w-40"
                placeholder="Label (e.g. Personal)"
                value={f.label}
                onChange={(e) => updateFeed(f.id, { label: e.target.value })}
              />
              <input
                className="input flex-1 font-mono text-xs"
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                value={f.url}
                onChange={(e) => updateFeed(f.id, { url: e.target.value })}
              />
              <button className="btn-ghost text-red-500" onClick={() => removeFeed(f.id)}>✕</button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={addFeed}>+ Add calendar</button>
          <button
            className="btn-primary ml-auto"
            disabled={syncing || s.icsFeeds.filter((f) => f.url.trim()).length === 0}
            onClick={runSync}
          >
            {syncing ? 'Importing…' : 'Import calendars'}
          </button>
        </div>

        {msg && (
          <div className={`mt-2 rounded-md p-2 text-xs ${
            msg.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : msg.tone === 'warn'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}>
            {msg.text}
          </div>
        )}
        {allDay.length > 0 && (
          <div className="mt-3 rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="label mb-1.5">
              {allDay.length} all-day event(s) — shown, not blocking time
            </div>
            <p className="mb-2 text-[11px] text-slate-400">
              These have no start/end time, so they can't be treated as busy. They're listed here so you know they exist (holidays, exam periods). Block the day manually if one of them is a real commitment.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {allDay.slice(0, 20).map((a, i) => (
                <div key={`${a.title}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-600 dark:text-slate-300">{a.title}</span>
                  <span className="shrink-0 text-slate-400">
                    {a.start === a.end ? a.start : `${a.start} → ${a.end}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {syncInfo.tasks > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {syncInfo.tasks} Google Task(s) found — not imported
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Tasks have no start/end time, so they can't block time in your day. They're also
              separate from this app's planner — merging two task lists would blow through the
              {s.maxCoreTasks}-core-task cap that keeps the day achievable. Keep deadlines in
              Quant-OS (Reviews → deadlines) and let the planner decide what fits today.
            </p>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-400">
          Read-only, and fetched on the server: the browser can't reach Google's calendar directly, so the app asks its own endpoint to do it. Only <code className="font-mono">calendar.google.com</code> feeds are accepted. Weekly events repeat; one-off events are pinned to their exact date.
        </p>
      </Card>

      {/* ---------------------------------------------------- fixed blocks */}
      <Card>
        <SectionTitle right={<button className="btn-ghost" onClick={() => setEditing(blankBlock())}>+ Add</button>}>
          Fixed commitments
        </SectionTitle>
        <p className="mb-3 text-xs text-slate-400">
          Lectures, tutorials, part-time shifts, gym — anything that isn't negotiable. Tasks get placed around these.
        </p>
        <div className="space-y-1.5">
          {state.fixedBlocks.length === 0 && <EmptyState>No commitments yet. Import your calendar or add them by hand.</EmptyState>}
          {[...state.fixedBlocks]
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((b) => {
              const weekly = b.days.length > 0;
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{b.title}</div>
                    <div className="text-xs text-slate-400">
                      {b.start}–{b.end} ·{' '}
                      {weekly
                        ? `weekly: ${b.days.map((d) => DAY_SHORT[d]).join(', ')}`
                        : `once, ${b.date ?? 'unscheduled'}`}
                      {b.location === 'campus' ? ' · on campus' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.calendarLabel && <Chip>{b.calendarLabel}</Chip>}
                    <Chip tone={b.source === 'ics' ? 'ai' : 'default'}>
                      {b.source === 'ics' ? (weekly ? 'weekly' : 'one-off') : 'manual'}
                    </Chip>
                    <button className="text-xs text-indigo-500 hover:underline" onClick={() => setEditing(b)}>Edit</button>
                    <button className="text-xs text-red-400 hover:underline" onClick={() => removeFixedBlock(b.id)}>✕</button>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* --------------------------------------------------------- preview */}
      <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <SectionTitle>Today's free slots</SectionTitle>
        {preview.slots.length === 0 ? (
          <p className="text-sm text-slate-500">No usable gap found — your calendar is packed between {s.wakeTime} and {s.sleepTime}.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {preview.slots.map((sl, i) => (
              <span key={i} className="chip bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {sl.start}–{sl.end} · {sl.minutes}m
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          {Math.round((preview.freeMinutes / 60) * 10) / 10}h free · {Math.round((preview.busyMinutes / 60) * 10) / 10}h committed · {blocksForDate(state.fixedBlocks, today()).length} blocks today
        </p>
      </Card>

      {/* ------------------------------------------------------------ edit */}
      {editing && (
        <BlockModal
          block={editing}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            const exists = state.fixedBlocks.some((x) => x.id === b.id);
            if (exists) updateFixedBlock(b);
            else addFixedBlock(b);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function blankBlock(): FixedBlock {
  return { id: uid('fb-'), title: '', start: '09:00', end: '10:30', days: [1], location: 'anywhere', source: 'manual' };
}

function BlockModal({ block, onClose, onSave }: { block: FixedBlock; onClose: () => void; onSave: (b: FixedBlock) => void }) {
  const [b, setB] = useState<FixedBlock>(block);
  const toggleDay = (d: number) =>
    setB({ ...b, days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort() });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold">{b.id && b.title ? 'Edit commitment' : 'New commitment'}</h3>
        <Field label="Title">
          <input className="input" autoFocus value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="e.g. MH3100 Lecture" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><input type="time" className="input" value={b.start} onChange={(e) => setB({ ...b, start: e.target.value })} /></Field>
          <Field label="End"><input type="time" className="input" value={b.end} onChange={(e) => setB({ ...b, end: e.target.value })} /></Field>
        </div>
        <Field label="Repeats on">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_NAMES.map((name, i) => (
              <button key={name} onClick={() => toggleDay(i)} className={`chip ${b.days.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {DAY_SHORT[i]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Location">
          <select className="input" value={b.location} onChange={(e) => setB({ ...b, location: e.target.value as TaskLocation })}>
            <option value="anywhere">Anywhere</option>
            <option value="campus">On campus</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!b.title || b.start === b.end} onClick={() => onSave(b)}>Save</button>
        </div>
      </div>
    </div>
  );
}
