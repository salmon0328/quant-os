import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { today, formatLong, addDays } from '../lib/date';
import { ENERGY_LABEL } from '../engine/taskGenerator';
import type { EnergyMode, Task } from '../models';
import { Card, SectionTitle, EmptyState, Field } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import { uid } from '../lib/id';
import { PILLARS } from '../data/pillars';

const ENERGIES: EnergyMode[] = ['low', 'normal', 'high'];

export default function Today() {
  const app = useApp();
  const { state, energyFor, setEnergy, ensureTasksForDate, regenerateTasks, rescheduleMissed, addTask } = app;
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
  const totalMin = tasks.filter((t) => t.status !== 'done').reduce((a, t) => a + t.minutes, 0);
  const doneMin = tasks.filter((t) => t.status === 'done').reduce((a, t) => a + t.minutes, 0);
  const pct = tasks.length ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100) : 0;

  // Missed core tasks from yesterday
  const yesterday = addDays(d, -1);
  const missedYesterday = state.tasks.filter((t) => t.date === yesterday && t.status === 'pending' && t.priority === 'core');

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
                {e === 'low' ? 'Min' : e}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setNotes(regenerateTasks(d).notes)}>↻ Regenerate</button>
        </div>
      </div>

      <p className="text-xs text-slate-400">{ENERGY_LABEL[energy]}</p>

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
              You have <b>{missedYesterday.length}</b> unfinished core task(s) from yesterday. Reschedule them intelligently across the next few days?
            </div>
            <button className="btn-primary" onClick={() => { const n = rescheduleMissed(yesterday); alert(`Rescheduled ${n} task(s) across the next 3 days.`); }}>Reschedule</button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="label">Remaining time</div><div className="mt-1 text-2xl font-bold">{totalMin}<span className="text-sm font-normal text-slate-400">m</span></div></Card>
        <Card><div className="label">Done</div><div className="mt-1 text-2xl font-bold text-emerald-500">{doneMin}<span className="text-sm font-normal text-slate-400">m</span></div></Card>
        <Card><div className="label">Completion</div><div className="mt-1 text-2xl font-bold text-indigo-500">{pct}%</div></Card>
      </div>

      <Card>
        <SectionTitle right={<button className="btn-ghost" onClick={() => setShowAdd(!showAdd)}>+ Add task</button>}>Tasks</SectionTitle>
        {showAdd && <AddTaskForm date={d} onAdd={(t) => { addTask(t); setShowAdd(false); }} />}
        {tasks.length === 0 ? (
          <EmptyState>No tasks. Set your energy level to generate today's plan.</EmptyState>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
      </Card>
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
