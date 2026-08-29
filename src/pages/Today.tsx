import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppState';
import { today, formatLong, addDays } from '../lib/date';
import { blocksForDate, freeSlots, toMinutes } from '../engine/scheduler';
import type { EnergyMode, Task } from '../models';
import { Card, SectionTitle, EmptyState, Field } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import { uid } from '../lib/id';
import { PILLARS } from '../data/pillars';

const ENERGIES: EnergyMode[] = ['low', 'normal', 'high'];

export default function Today() {
  const app = useApp();
  const { state, energyFor, setEnergy, ensureTasksForDate, regenerateTasks, rescheduleMissed, addTask, rescheduleDay } = app;
  const d = today();
  const [notes, setNotes] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const res = ensureTasksForDate(d);
    setNotes(res.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const energy = energyFor(d);
  const tasks = useMemo(() => state.tasks.filter((t) => t.date === d), [state.tasks, d]);
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const totalMin = tasks.filter((t) => t.status !== 'done').reduce((a, t) => a + t.minutes, 0);
  const doneMin = doneTasks.reduce((a, t) => a + t.minutes, 0);
  const pct = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const yesterday = addDays(d, -1);
  const missedYesterday = state.tasks.filter((t) => t.date === yesterday && t.status === 'pending' && t.priority === 'core');

  const blocks = blocksForDate(state.fixedBlocks, d);
  const { freeMinutes, busyMinutes } = freeSlots(state.fixedBlocks, state.schedule, d);
  const scheduled = tasks.filter((t) => t.startTime);
  const unscheduled = tasks.filter((t) => !t.startTime);

  const timeline = useMemo(() => {
    const items: { key: string; start: string; kind: 'block' | 'task'; ref: Task | (typeof blocks)[number] }[] = [];
    blocks.forEach((b) => items.push({ key: `b-${b.id}`, start: b.start, kind: 'block', ref: b }));
    scheduled.forEach((t) => items.push({ key: `t-${t.id}`, start: t.startTime as string, kind: 'task', ref: t }));
    return items.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [blocks, scheduled]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-sm text-slate-400">{formatLong(d)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {ENERGIES.map((e) => (
              <button
                key={e}
                onClick={() => setNotes(setEnergy(d, e).notes)}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${energy === e ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {e === 'low' ? 'Min' : e === 'high' ? 'Big' : 'Normal'}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setNotes(regenerateTasks(d).notes)}>↻ Regenerate</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="label">To do</div>
          <div className="mt-1 text-2xl font-bold">{totalMin}<span className="text-sm font-normal text-slate-400">m</span></div>
        </Card>
        <Card>
          <div className="label">Done</div>
          <div className="mt-1 text-2xl font-bold text-emerald-500">{doneMin}<span className="text-sm font-normal text-slate-400">m</span></div>
        </Card>
        <Card>
          <div className="label">Completion</div>
          <div className="mt-1 text-2xl font-bold text-indigo-500">{pct}%</div>
        </Card>
        <Card>
          <div className="label">Free time</div>
          <div className="mt-1 text-2xl font-bold">{Math.round((freeMinutes / 60) * 10) / 10}<span className="text-sm font-normal text-slate-400">h</span></div>
          <div className="text-[10px] text-slate-400">{Math.round((busyMinutes / 60) * 10) / 10}h committed</div>
        </Card>
      </div>

      {/* Adaptive engine notes */}
      {notes.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="label mb-2 text-indigo-500">Adaptive engine</div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {notes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </Card>
      )}

      {/* Missed reschedule prompt */}
      {missedYesterday.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              You have <b>{missedYesterday.length}</b> unfinished core task(s) from yesterday. Spread them across the next few days?
            </div>
            <button className="btn-primary" onClick={() => { const n = rescheduleMissed(yesterday); alert(`Rescheduled ${n} task(s) across the next 3 days.`); }}>Reschedule</button>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- timeline */}
      <Card>
        <SectionTitle right={
          <div className="flex items-center gap-3">
            {blocks.length > 0 && <button className="text-xs text-indigo-500 hover:underline" onClick={() => rescheduleDay(d)}>Re-fit times</button>}
            <button className="btn-ghost" onClick={() => setShowAdd(!showAdd)}>+ Add task</button>
          </div>
        }>
          Your day
        </SectionTitle>

        {showAdd && <AddTaskForm date={d} onAdd={(t) => { addTask(t); setShowAdd(false); rescheduleDay(d); }} />}

        {timeline.length === 0 ? (
          <EmptyState>Nothing scheduled. Set your energy level to generate the plan.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {timeline.map((it) => (
              <div key={it.key} className="flex gap-3">
                <div className="w-11 shrink-0 pt-1 text-right text-xs font-mono text-slate-400">{it.start}</div>
                <div className="min-w-0 flex-1">
                  {it.kind === 'block' ? (
                    <FixedRow title={(it.ref as (typeof blocks)[number]).title} start={it.start} end={(it.ref as (typeof blocks)[number]).end} campus={(it.ref as (typeof blocks)[number]).location === 'campus'} />
                  ) : (
                    <TaskItem task={it.ref as Task} compact />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {unscheduled.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="label mb-2">No free slot found</div>
            <div className="space-y-2">
              {unscheduled.map((t) => <TaskItem key={t.id} task={t} />)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Your calendar is tight today. Either trim something, or{' '}
              <Link to="/settings" className="text-indigo-500 hover:underline">adjust your working hours</Link>.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function FixedRow({ title, start, end, campus }: { title: string; start: string; end: string; campus: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-300">{title}</span>
        <span className="text-xs text-slate-400">{start}–{end}</span>
        {campus && <span className="text-[10px] font-bold text-amber-500">CAMPUS</span>}
      </div>
    </div>
  );
}

function AddTaskForm({ date, onAdd }: { date: string; onAdd: (t: Task) => void }) {
  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState(PILLARS[0].id);
  const [minutes, setMinutes] = useState(30);
  const [output, setOutput] = useState('');
  return (
    <div className="mb-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Pillar">
          <select className="input" value={pillar} onChange={(e) => setPillar(e.target.value as any)}>
            {PILLARS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Minutes"><input type="number" className="input" value={minutes} onChange={(e) => setMinutes(+e.target.value)} /></Field>
        <Field label="Output (what will you produce?)"><input className="input" value={output} onChange={(e) => setOutput(e.target.value)} /></Field>
      </div>
      <button
        className="btn-primary mt-1"
        disabled={!title}
        onClick={() => onAdd({ id: uid('t-'), date, pillar: pillar as any, category: 'technical', title, why: 'Self-added task.', minutes, output: output || 'Note what you produced.', priority: 'optional', status: 'pending', generated: false })}
      >Add</button>
    </div>
  );
}
