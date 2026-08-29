import { useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Field, Chip, EmptyState } from '../components/ui';
import { WEEKDAY_NAMES, today } from '../lib/date';
import { uid } from '../lib/id';
import type { FixedBlock, TaskLocation } from '../models';
import { freeSlots, blocksForDate, isCampusDay } from '../engine/scheduler';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { state, updateSchedule, syncCalendar, addFixedBlock, updateFixedBlock, removeFixedBlock } = useApp();
  const s = state.schedule;
  const [icsInput, setIcsInput] = useState(s.icsUrl ?? '');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState<FixedBlock | null>(null);

  const preview = freeSlots(state.fixedBlocks, s, today());
  const onCampus = isCampusDay(s, today());

  const runSync = async () => {
    setSyncing(true);
    setMsg(null);
    const res = await syncCalendar();
    setSyncing(false);
    setMsg(
      res.ok
        ? { tone: 'ok', text: `Imported ${res.imported ?? 0} recurring commitments.` }
        : { tone: 'err', text: res.error ?? 'Sync failed.' }
    );
  };

  const saveIcs = () => {
    updateSchedule({ icsUrl: icsInput.trim() || undefined });
    setMsg({ tone: 'ok', text: 'Link saved. Now press “Import calendar”.' });
  };

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
          Google Calendar
        </SectionTitle>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
          <li>Open <b>Google Calendar → Settings → [your calendar] → Integrate calendar</b>.</li>
          <li>Copy <b>“Secret address in iCal format”</b>.</li>
          <li>Paste it below and press Import.</li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1 font-mono text-xs"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            value={icsInput}
            onChange={(e) => setIcsInput(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={saveIcs}>Save link</button>
            <button className="btn-primary" disabled={syncing || !icsInput.trim()} onClick={runSync}>
              {syncing ? 'Importing…' : 'Import calendar'}
            </button>
          </div>
        </div>
        {msg && (
          <div className={`mt-2 rounded-md p-2 text-xs ${msg.tone === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}>
            {msg.text}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
          Read-only, and kept on the server: the browser can't fetch Google's calendar directly, so the app asks its own endpoint to do it. Only <code className="font-mono">calendar.google.com</code> feeds are accepted.
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
            .map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{b.title}</div>
                  <div className="text-xs text-slate-400">
                    {b.start}–{b.end} · {b.days.length ? b.days.map((d) => DAY_SHORT[d]).join(', ') : b.date}
                    {b.location === 'campus' ? ' · on campus' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={b.source === 'ics' ? 'ai' : 'default'}>{b.source === 'ics' ? 'calendar' : 'manual'}</Chip>
                  <button className="text-xs text-indigo-500 hover:underline" onClick={() => setEditing(b)}>Edit</button>
                  <button className="text-xs text-red-400 hover:underline" onClick={() => removeFixedBlock(b.id)}>✕</button>
                </div>
              </div>
            ))}
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
