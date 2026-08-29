import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppState';
import { today, formatLong, weekIndexFrom, monthIndexFrom, daysBetween } from '../lib/date';
import { weekForIndex } from '../data/curriculum';
import { Card, SectionTitle, ProgressBar, EmptyState } from '../components/ui';
import { RadarProfile } from '../components/RadarProfile';
import { TaskItem } from '../components/TaskItem';
import { weeklyProgress, neglectedPillar, currentStreak } from '../engine/profile';
import { PILLARS } from '../data/pillars';

export default function Home() {
  const { state, ensureTasksForDate } = useApp();
  const d = today();

  useEffect(() => { ensureTasksForDate(d); /* eslint-disable-next-line */ }, [d]);

  const weekIdx = weekIndexFrom(state.startDate, d);
  const cw = weekForIndex(weekIdx);
  const monthIdx = monthIndexFrom(weekIdx);

  const todays = useMemo(() => state.tasks.filter((t) => t.date === d), [state.tasks, d]);
  const priorities = todays.filter((t) => t.priority === 'core').slice(0, 3);
  const estMin = todays.filter((t) => t.status !== 'done').reduce((a, t) => a + t.minutes, 0);
  const wp = weeklyProgress(state, d);
  const streak = currentStreak(state, d);
  const neglect = neglectedPillar(state, d);
  const neglectPillar = PILLARS.find((p) => p.id === neglect.pillar)!;

  const activeProject = state.projects.find((p) => p.status === 'active') ?? state.projects.find((p) => p.status === 'backlog');
  const nextDeadline = [...state.deadlines].filter((x) => daysBetween(d, x.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{greet}, {state.profileName}.</h1>
        <p className="text-sm text-slate-400">{formatLong(d)} · Program week {weekIdx} · Month {monthIdx} — {cw.learningGoal}</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><div className="label">Estimated time today</div><div className="mt-1 text-2xl font-bold">{estMin}<span className="text-sm font-normal text-slate-400"> min</span></div></Card>
        <Card><div className="label">Current streak</div><div className="mt-1 text-2xl font-bold text-amber-500">{streak} 🔥</div></Card>
        <Card><div className="label">Weekly progress</div><div className="mt-1 text-2xl font-bold text-indigo-500">{wp}%</div><div className="mt-2"><ProgressBar value={wp} /></div></Card>
        <Card><div className="label">Neglected pillar</div><div className="mt-1 text-lg font-bold" style={{ color: neglectPillar.color }}>{neglectPillar.name.split(' ')[0]}</div><div className="text-xs text-slate-400">+{neglect.extraHours || 1}h suggested</div></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Priorities */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle right={<Link to="/today" className="text-sm text-indigo-500 hover:underline">Open Today →</Link>}>Today's priorities</SectionTitle>
            {priorities.length === 0 ? <EmptyState>Set your energy level in Today to generate the plan.</EmptyState> : (
              <div className="space-y-2">{priorities.map((t) => <TaskItem key={t.id} task={t} />)}</div>
            )}
          </Card>

          {/* This week's output */}
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-slate-900">
            <div className="label text-indigo-500">This week's output</div>
            <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{cw.outputGoal}</div>
            <p className="mt-1 text-sm text-slate-500">Output {'>'} consumption. Every week must produce something tangible.</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md bg-white/60 p-2 dark:bg-slate-800/60"><span className="label">Learning</span><div className="mt-0.5">{cw.learningGoal}</div></div>
              <div className="rounded-md bg-white/60 p-2 dark:bg-slate-800/60"><span className="label">Career</span><div className="mt-0.5">{cw.careerGoal}</div></div>
              <div className="rounded-md bg-white/60 p-2 dark:bg-slate-800/60"><span className="label">Review</span><div className="mt-0.5">{cw.reviewGoal}</div></div>
            </div>
          </Card>
        </div>

        {/* Radar + side cards */}
        <div className="space-y-5">
          <Card>
            <SectionTitle right={<Link to="/reviews" className="text-sm text-indigo-500 hover:underline">Detail →</Link>}>Your profile</SectionTitle>
            <RadarProfile pillars={state.pillars} dark={state.theme === 'dark'} />
          </Card>
          <Card>
            <div className="label">This week's project</div>
            {activeProject ? (
              <>
                <Link to="/projects" className="mt-1 block text-base font-semibold text-slate-800 hover:text-indigo-500 dark:text-slate-100">{activeProject.name}</Link>
                <div className="mt-1 text-xs text-slate-400">Next: {activeProject.nextAction}</div>
              </>
            ) : <div className="text-sm text-slate-400">No active project.</div>}
          </Card>
          <Card>
            <div className="label">Upcoming deadline</div>
            {nextDeadline ? (
              <>
                <div className="mt-1 text-base font-semibold">{nextDeadline.title}</div>
                <div className="text-xs text-slate-400">{nextDeadline.date} · in {daysBetween(d, nextDeadline.date)} days</div>
              </>
            ) : <div className="mt-1 text-sm text-slate-400">None. <Link to="/reviews" className="text-indigo-500 hover:underline">Add one</Link></div>}
          </Card>
        </div>
      </div>

      {/* Philosophy footer */}
      <Card className="text-center text-xs text-slate-400">
        Treat outcomes as a probability distribution · take many high-quality attempts · avoid local maxima by developing across pillars · produce, don't just consume.
      </Card>
    </div>
  );
}
