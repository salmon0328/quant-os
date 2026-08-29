import { useState } from 'react';
import { CURRICULUM } from '../data/curriculum';
import { useApp } from '../store/AppState';
import { weekIndexFrom, today } from '../lib/date';
import { Card, Chip } from '../components/ui';
import { PILLARS } from '../data/pillars';

export default function Roadmap() {
  const { state } = useApp();
  const currentWeek = weekIndexFrom(state.startDate, today());
  const [open, setOpen] = useState<number>(Math.min(12, Math.max(1, Math.ceil(currentWeek / 4))));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">12-Month Roadmap</h1>
        <p className="text-sm text-slate-400">Adaptive, not rigid. You are on program week {currentWeek}. Each month → 4 weeks with a tangible output.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CURRICULUM.map((m) => {
          const isCurrent = Math.ceil(currentWeek / 4) === m.month;
          const isPast = m.month < Math.ceil(currentWeek / 4);
          return (
            <button key={m.month} onClick={() => setOpen(m.month)} className={`card text-left transition-all hover:shadow-md ${open === m.month ? 'ring-2 ring-indigo-500' : ''} ${isCurrent ? 'border-indigo-400' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="label">Month {m.month}</span>
                {isCurrent && <Chip tone="output">current</Chip>}
                {isPast && <span className="text-xs text-emerald-500">✓</span>}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{m.theme}</div>
              <div className="mt-1 flex flex-wrap gap-1">{m.focus.slice(0, 3).map((f) => <span key={f} className="text-[10px] text-slate-400">#{f}</span>)}</div>
            </button>
          );
        })}
      </div>

      {CURRICULUM.filter((m) => m.month === open).map((m) => (
        <Card key={m.month}>
          <div className="mb-3">
            <span className="label">Month {m.month}</span>
            <h2 className="text-lg font-semibold">{m.theme}</h2>
          </div>
          <div className="space-y-3">
            {m.weeks.map((w) => {
              const pillar = PILLARS.find((p) => p.id === w.primaryPillar)!;
              const isCurrent = w.week === currentWeek;
              return (
                <div key={w.week} className={`rounded-lg border p-3 ${isCurrent ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: pillar.color }}>Week {w.week}</span>
                    <Chip tone={w.primaryPillar}>{pillar.name.split(' ')[0]}</Chip>
                    {isCurrent && <span className="text-[10px] font-bold text-indigo-500">YOU ARE HERE</span>}
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div><span className="label">Learn</span><div>{w.learningGoal}</div></div>
                    <div><span className="label">Output</span><div className="font-medium text-indigo-500">{w.outputGoal}</div></div>
                    <div><span className="label">Career</span><div>{w.careerGoal}</div></div>
                    <div><span className="label">Review</span><div>{w.reviewGoal}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
