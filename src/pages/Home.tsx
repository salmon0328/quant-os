import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppState';
import { today, formatLong, weekIndexFrom, monthIndexFrom, daysBetween } from '../lib/date';
import { weekForIndex } from '../data/curriculum';
import { Card, SectionTitle, ProgressBar, EmptyState } from '../components/ui';
import { RadarProfile } from '../components/RadarProfile';
import { TaskItem } from '../components/TaskItem';
import { weeklyProgress, currentStreak } from '../engine/profile';
import { blocksForDate, endTimeOf, freeSlots, toMinutes } from '../engine/scheduler';

export default function Home() {
  const { state, ensureTasksForDate } = useApp();
  const d = today();

  useEffect(() => { ensureTasksForDate(d); /* eslint-disable-next-line */ }, [d]);

  const weekIdx = weekIndexFrom(state.startDate, d);
  const cw = weekForIndex(weekIdx);
  const monthIdx = monthIndexFrom(weekIdx);

  const todays = useMemo(() => state.tasks.filter((t) => t.date === d), [state.tasks, d]);
  const remaining = todays.filter((t) => t.status !== 'done');
  const estMin = remaining.reduce((a, t) => a + t.minutes, 0);
  const wp = weeklyProgress(state, d);
  const streak = currentStreak(state, d);

  const blocks = blocksForDate(state.fixedBlocks, d);
  const { freeMinutes } = freeSlots(state.fixedBlocks, state.schedule, d);

  // What's on next: the first thing in the timeline that hasn't finished yet.
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const timeline = useMemo(() => {
    const items: { key: string; start: string; end: string; title: string; kind: 'task' | 'block' }[] = [];
    blocks.forEach((b) => items.push({ key: `b-${b.id}`, start: b.start, end: b.end, title: b.title, kind: 'block' }));
    todays.filter((t) => t.startTime).forEach((t) =>
      items.push({ key: `t-${t.id}`, start: t.startTime as string, end: endTimeOf(t), title: t.title, kind: 'task' })
    );
    return items.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [blocks, todays]);

  const nextUp = timeline.find((x) => toMinutes(x.end) > nowMinutes);
  const inboxCount = (state.feed ?? []).filter((f) => f.status === 'inbox').length;
  const dueCards = Object.values(state.cardProgress ?? {}).filter((p) => p.nextReview <= d).length;
  const activeProject = state.projects.find((p) => p.status === 'active') ?? state.projects.find((p) => p.status === 'backlog');
  const nextDeadline = [...state.deadlines].filter((x) => daysBetween(d, x.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{greet}, {state.profileName}.</h1>
        <p className="text-sm text-slate-400">
          {formatLong(d)} · Week {weekIdx}, Month {monthIdx} — {cw.learningGoal}
        </p>
      </div>

      {/* ------------------------------------------------------- next up */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-slate-900">
        <div className="label text-indigo-500">{nextUp ? 'Up next' : 'Nothing left today'}</div>
        {nextUp ? (
          <>
            <div className="mt-1 text-xl font-semibold">{nextUp.title}</div>
            <div className="mt-0.5 text-sm text-slate-500">
              {nextUp.start}–{nextUp.end} · {nextUp.kind === 'block' ? 'fixed commitment' : 'scheduled work'}
            </div>
          </>
        ) : (
          <div className="mt-1 text-lg font-semibold">
            {todays.length === 0 ? 'No plan yet — open Today to generate one.' : 'Everything is done. Genuinely done.'}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <div className="label">Left today</div>
          <div className="mt-1 text-2xl font-bold">{estMin}<span className="text-sm font-normal text-slate-400"> min</span></div>
        </Card>
        <Card>
          <div className="label">Streak</div>
          <div className="mt-1 text-2xl font-bold text-amber-500">{streak} 🔥</div>
        </Card>
        <Card>
          <div className="label">Weekly progress</div>
          <div className="mt-1 text-2xl font-bold text-indigo-500">{wp}%</div>
          <div className="mt-2"><ProgressBar value={wp} /></div>
        </Card>
        <Card>
          <div className="label">Free time today</div>
          <div className="mt-1 text-2xl font-bold">{Math.round((freeMinutes / 60) * 10) / 10}<span className="text-sm font-normal text-slate-400">h</span></div>
          <div className="text-[10px] text-slate-400">{blocks.length} commitments</div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle right={<Link to="/today" className="text-sm text-indigo-500 hover:underline">Open Today →</Link>}>
              Today — {remaining.length} left
            </SectionTitle>
            {todays.length === 0 ? (
              <EmptyState>Set your energy level in Today to generate the plan.</EmptyState>
            ) : (
              <div className="space-y-2">
                {todays
                  .slice()
                  .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'core' ? -1 : 1))
                  .map((t) => <TaskItem key={t.id} task={t} compact />)}
              </div>
            )}
          </Card>

          <Card>
            <div className="label">This week's output</div>
            <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{cw.outputGoal}</div>
            <p className="mt-1 text-sm text-slate-500">One tangible thing. Everything else is input.</p>
          </Card>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/inbox" className="card transition-all hover:shadow-md">
              <div className="label">Inbox</div>
              <div className="mt-1 text-2xl font-bold">{inboxCount}</div>
              <div className="text-[10px] text-slate-400">queued to read</div>
            </Link>
            <Link to="/knowledge" className="card transition-all hover:shadow-md">
              <div className="label">Drill</div>
              <div className="mt-1 text-2xl font-bold text-pink-500">{dueCards}</div>
              <div className="text-[10px] text-slate-400">cards due</div>
            </Link>
          </div>

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

      <Card className="text-center text-xs text-slate-400">
        Two core tasks a day beats six you never finish · produce, don't just consume.
      </Card>
    </div>
  );
}
