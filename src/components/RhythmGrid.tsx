import { useMemo } from 'react';
import { TASK_KINDS, DAY_SHORT, minutesFor } from '../data/cadence';
import type { ScheduleSettings } from '../models';

interface Props {
  schedule: ScheduleSettings;
  onChange: (kindId: string, days: number[]) => void;
}

/**
 * The weekly rhythm, made visible. Each row is a task kind, each column a
 * weekday, and the footer totals show whether any day is overloaded or empty —
 * which is the only way to notice that e.g. weekends swallowed all the work.
 */
export function RhythmGrid({ schedule, onChange }: Props) {
  const cadences = schedule.cadences ?? {};

  const daysFor = (kindId: string, fallback: number[]) => {
    const custom = cadences[kindId];
    return custom && custom.length > 0 ? custom : fallback;
  };

  const perDay = useMemo(() => {
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const kind of TASK_KINDS) {
      const on = daysFor(kind.id, kind.defaultDays);
      for (const d of on) {
        totals[d] += kind.micro ? 0 : minutesFor(kind, d);
        counts[d] += 1;
      }
    }
    return { totals, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadences]);

  const maxTotal = Math.max(...perDay.totals, 1);

  const toggle = (kindId: string, fallback: number[], day: number) => {
    const current = daysFor(kindId, fallback);
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    onChange(kindId, next.sort());
  };

  return (
    <div>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="px-1 text-left font-medium text-slate-400">Task</th>
              {DAY_SHORT.map((d) => (
                <th key={d} className="w-[52px] text-center font-medium text-slate-400">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TASK_KINDS.map((kind) => {
              const on = daysFor(kind.id, kind.defaultDays);
              return (
                <tr key={kind.id}>
                  <td className="px-1">
                    <div className="font-medium text-slate-700 dark:text-slate-200">{kind.label}</div>
                    <div className="text-[10px] text-slate-400">
                      {kind.minutes}m{kind.weekendMinutes ? `/${kind.weekendMinutes}m wknd` : ''}
                      {kind.micro ? ' · micro' : ''} · {kind.priority}
                    </div>
                  </td>
                  {DAY_SHORT.map((_, d) => {
                    const active = on.includes(d);
                    return (
                      <td key={d} className="p-0 text-center">
                        <button
                          onClick={() => toggle(kind.id, kind.defaultDays, d)}
                          aria-pressed={active}
                          aria-label={`${kind.label} on ${DAY_SHORT[d]}`}
                          className={`h-7 w-11 rounded transition-colors ${
                            active
                              ? kind.priority === 'core'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-300 text-indigo-900 dark:bg-indigo-500/50 dark:text-indigo-100'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                          }`}
                        >
                          {active ? '●' : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-1 pt-2 text-[10px] font-medium text-slate-400">Scheduled</td>
              {DAY_SHORT.map((_, d) => (
                <td key={d} className="px-0.5 pt-2 text-center">
                  <div
                    className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                      perDay.totals[d] > 180
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : perDay.totals[d] < 40
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                    title={`${perDay.counts[d]} task(s)`}
                  >
                    {perDay.totals[d] > 0 ? `${perDay.totals[d]}m` : '—'}
                  </div>
                  <div
                    className="mt-0.5 h-1 rounded bg-slate-200 dark:bg-slate-700"
                    style={{ width: `${(perDay.totals[d] / maxTotal) * 100}%` }}
                  />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        Tap a day to switch a task on or off there. Totals exclude micro tasks and show only the
        scheduled minutes — the daily cap still applies, so a day scheduled over your budget gets
        trimmed. Green is balanced, amber is a light day, red is overloaded.
      </p>
    </div>
  );
}
