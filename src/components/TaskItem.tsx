import { useState } from 'react';
import type { Task } from '../models';
import { Chip } from './ui';
import { useApp } from '../store/AppState';
import { PILLARS } from '../data/pillars';
import { endTimeOf } from '../engine/scheduler';

export function TaskItem({ task, compact, showDate }: { task: Task; compact?: boolean; showDate?: boolean }) {
  const { toggleTask, deleteTask, state } = useApp();
  const [open, setOpen] = useState(false);
  const done = task.status === 'done';
  const resource = task.resourceId ? state.resources.find((r) => r.id === task.resourceId) : undefined;
  const pillar = PILLARS.find((p) => p.id === task.pillar);

  return (
    <div className={`rounded-lg border p-3 transition-colors ${done ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => toggleTask(task.id)}
          aria-label="toggle"
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
        >
          {done && '✓'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{task.title}</span>
            <Chip tone={task.category}>{task.category}</Chip>
            {pillar && <span className="text-[10px] font-semibold" style={{ color: pillar.color }}>{pillar.name.split(' ')[0]}</span>}
            {task.startTime && (
              <span className="font-mono text-[11px] text-indigo-500">
                {task.startTime}–{endTimeOf(task)}
              </span>
            )}
            <span className="text-xs text-slate-400">{task.minutes}m</span>
            {task.priority === 'core' && <span className="text-[10px] font-bold text-indigo-500">CORE</span>}
            {task.location === 'campus' && <span className="text-[10px] font-bold text-amber-500">CAMPUS</span>}
            {task.rescheduledFrom && <span className="text-[10px] text-amber-500">rescheduled</span>}
            {showDate && <span className="text-[10px] text-slate-400">{task.date}</span>}
          </div>

          {task.url && (
            <a href={task.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs text-indigo-500 hover:underline">
              Open source ↗
            </a>
          )}

          <button onClick={() => setOpen(!open)} className="mt-1 text-xs text-slate-400 hover:underline">
            {open ? 'Hide details' : compact ? 'Why / output' : 'Why / output / resource'}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
              <div><span className="font-semibold text-slate-500">Why: </span><span className="text-slate-600 dark:text-slate-300">{task.why}</span></div>
              <div><span className="font-semibold text-slate-500">Produce: </span><span className="text-slate-600 dark:text-slate-300">{task.output}</span></div>
              {task.resourceHint && <div><span className="font-semibold text-slate-500">Resource: </span>{task.resourceHint}</div>}
              {resource && (
                <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-500 hover:underline">
                  ↗ {resource.title} {resource.access === 'paywalled' && <span className="text-amber-500">($)</span>}
                </a>
              )}
              <div className="pt-1">
                <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:underline">Remove task</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
