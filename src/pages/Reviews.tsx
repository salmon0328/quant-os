import { useRef, useState } from 'react';
import { useApp } from '../store/AppState';
import { useAuth } from '../store/AuthState';
import { Card, SectionTitle, ProgressBar, Field, EmptyState } from '../components/ui';
import { RadarProfile } from '../components/RadarProfile';
import type { WeeklyReview, MonthlyReview, Deadline } from '../models';
import { today, mondayOf, weekIndexFrom } from '../lib/date';
import { weekForIndex } from '../data/curriculum';
import { investmentRatios, neglectedPillar } from '../engine/profile';
import { uid } from '../lib/id';
import { PILLARS } from '../data/pillars';

const WEEKLY_Q: { key: keyof WeeklyReview; label: string }[] = [
  { key: 'learned', label: '1. What did I learn?' },
  { key: 'built', label: '2. What did I build?' },
  { key: 'read', label: '3. What did I read?' },
  { key: 'biggestImprovement', label: '4. Biggest improvement?' },
  { key: 'biggestWeakness', label: '5. Biggest weakness?' },
  { key: 'enjoyed', label: '6. What did I enjoy?' },
  { key: 'disliked', label: '7. What did I dislike?' },
  { key: 'surprised', label: '8. What surprised me?' },
  { key: 'opportunity', label: '9. What opportunity did I discover?' },
  { key: 'stopDoing', label: '10. What should I stop doing?' },
  { key: 'startDoing', label: '11. What should I start doing?' },
  { key: 'continueDoing', label: '12. What should I continue doing?' },
  { key: 'nextMostImportantOutput', label: "13. Next week's single most important output?" },
];

const MONTHLY_Q: { key: keyof MonthlyReview; label: string }[] = [
  { key: 'startingCapability', label: 'Starting capability' },
  { key: 'currentCapability', label: 'Current capability' },
  { key: 'biggestGains', label: 'Biggest gains' },
  { key: 'biggestWeaknesses', label: 'Biggest weaknesses' },
  { key: 'highestRoi', label: 'Highest-ROI activity' },
  { key: 'lowestRoi', label: 'Lowest-ROI activity' },
  { key: 'newCareerDirection', label: 'Possible new career direction' },
  { key: 'nextMonthPriorities', label: "Next month's priorities" },
];

export default function Reviews() {
  const { state, patch, reset } = useApp();
  const d = today();
  const [tab, setTab] = useState<'optimise' | 'weekly' | 'monthly' | 'settings'>('optimise');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reviews & Optimisation</h1>
        <p className="text-sm text-slate-400">Identify strengths, weaknesses, neglected areas, and opportunities — then plan.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['optimise', 'weekly', 'monthly', 'settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn capitalize ${tab === t ? 'btn-primary' : 'btn-ghost'}`}>{t === 'optimise' ? 'Optimisation' : t}</button>
        ))}
      </div>

      {tab === 'optimise' && <Optimise />}
      {tab === 'weekly' && <Weekly />}
      {tab === 'monthly' && <Monthly />}
      {tab === 'settings' && <Settings reset={reset} />}
    </div>
  );

  function Optimise() {
    const ratios = investmentRatios(state, d);
    const neglect = neglectedPillar(state, d);
    const np = PILLARS.find((p) => p.id === neglect.pillar)!;
    const setScore = (id: string, v: number) => patch({ pillars: state.pillars.map((p) => (p.id === id ? { ...p, score: v } : p)) });

    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Capability profile</SectionTitle>
          <RadarProfile pillars={state.pillars} dark={state.theme === 'dark'} />
        </Card>
        <Card>
          <SectionTitle>Pillar scores (self-assessed)</SectionTitle>
          <div className="space-y-3">
            {state.pillars.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex justify-between text-xs"><span style={{ color: p.color }} className="font-semibold">{p.name}</span><span>{p.score}%</span></div>
                <ProgressBar value={p.score} color={p.color} />
                <input type="range" min={0} max={100} value={p.score} onChange={(e) => setScore(p.id, +e.target.value)} className="mt-1 w-full accent-indigo-500" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2 border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10">
          <SectionTitle>Where am I under-investing?</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-3">
            {state.pillars.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex justify-between text-xs"><span style={{ color: p.color }}>{p.name.split(' ')[0]}</span><span>{Math.round(ratios[p.id] * 100)}% of target</span></div>
                <ProgressBar value={ratios[p.id] * 100} color={p.color} />
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-800/60">
            <b>Your biggest neglected pillar this week is {np.name}.</b> Allocate roughly <b>{neglect.extraHours || 1.5} additional hours</b> — this is where extra effort has the highest ROI right now. (Based on last 7 days of completed tasks + your capability scores.)
          </p>
        </Card>
      </div>
    );
  }

  function Weekly() {
    const weekOf = mondayOf(d);
    const existing = state.weeklyReviews.find((r) => r.weekOf === weekOf);
    const [form, setForm] = useState<WeeklyReview>(existing ?? { id: '', weekOf, learned: '', built: '', read: '', biggestImprovement: '', biggestWeakness: '', enjoyed: '', disliked: '', surprised: '', opportunity: '', stopDoing: '', startDoing: '', continueDoing: '', nextMostImportantOutput: '' });
    const nextWeek = weekForIndex(weekIndexFrom(state.startDate, d) + 1);

    const save = () => {
      if (form.id) patch({ weeklyReviews: state.weeklyReviews.map((r) => (r.id === form.id ? form : r)) });
      else patch({ weeklyReviews: [...state.weeklyReviews, { ...form, id: uid('wr-') }] });
      alert('Weekly review saved.');
    };

    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Weekly review — week of {weekOf}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEEKLY_Q.map((q) => (
              <div key={q.key} className={q.key === 'nextMostImportantOutput' ? 'sm:col-span-2' : ''}>
                <Field label={q.label}><textarea className="input" rows={2} value={form[q.key] as string} onChange={(e) => setForm({ ...form, [q.key]: e.target.value })} /></Field>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-2" onClick={save}>Save weekly review</button>
        </Card>
        <div className="space-y-5">
          <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <SectionTitle>Next week's plan</SectionTitle>
            <div className="space-y-2 text-sm">
              <div><span className="label">Learning</span><div>{nextWeek.learningGoal}</div></div>
              <div><span className="label">Output</span><div className="font-semibold text-indigo-500">{nextWeek.outputGoal}</div></div>
              <div><span className="label">Career</span><div>{nextWeek.careerGoal}</div></div>
              <div><span className="label">Your #1 output</span><div className="italic">{form.nextMostImportantOutput || '— set it above —'}</div></div>
            </div>
          </Card>
          <Card>
            <SectionTitle>Past reviews</SectionTitle>
            {state.weeklyReviews.length === 0 ? <EmptyState>None yet.</EmptyState> : (
              <ul className="space-y-1 text-xs">
                {[...state.weeklyReviews].sort((a, b) => b.weekOf.localeCompare(a.weekOf)).map((r) => (
                  <li key={r.id} className="text-slate-500">• {r.weekOf}: {r.nextMostImportantOutput || r.learned || '(saved)'}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    );
  }

  function Monthly() {
    const month = d.slice(0, 7);
    const existing = state.monthlyReviews.find((r) => r.month === month);
    const [form, setForm] = useState<MonthlyReview>(existing ?? { id: '', month, startingCapability: '', currentCapability: '', biggestGains: '', biggestWeaknesses: '', highestRoi: '', lowestRoi: '', newCareerDirection: '', nextMonthPriorities: '' });
    const save = () => {
      if (form.id) patch({ monthlyReviews: state.monthlyReviews.map((r) => (r.id === form.id ? form : r)) });
      else patch({ monthlyReviews: [...state.monthlyReviews, { ...form, id: uid('mr-') }] });
      alert('Monthly review saved.');
    };
    return (
      <Card>
        <SectionTitle>Monthly review — {month}</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {MONTHLY_Q.map((q) => (
            <Field key={q.key} label={q.label}><textarea className="input" rows={2} value={form[q.key] as string} onChange={(e) => setForm({ ...form, [q.key]: e.target.value })} /></Field>
          ))}
        </div>
        <button className="btn-primary mt-2" onClick={save}>Save monthly review</button>
      </Card>
    );
  }
}

const SYNC_LABEL: Record<string, string> = {
  idle: 'Local only — no device connected yet',
  offline: 'Local only — cloud sync not configured',
  syncing: 'Syncing…',
  synced: 'Synced to the cloud',
  error: 'Sync error — will retry on next change',
};

function Settings({ reset }: { reset: () => void }) {
  const { state, patch, importState, syncEnabled, syncStatus } = useApp();
  const { session, signOut } = useAuth();
  const [dl, setDl] = useState<Deadline>({ id: '', title: '', date: today(), type: 'exam' });
  const importRef = useRef<HTMLInputElement>(null);

  const addDeadline = () => {
    if (!dl.title) return;
    patch({ deadlines: [...state.deadlines, { ...dl, id: uid('dl-') }] });
    setDl({ id: '', title: '', date: today(), type: 'exam' });
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quant-os-backup-${today()}.json`;
    a.click();
  };
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (confirm('Import will replace your current data with the contents of this file. Continue?')) {
        importState(parsed);
        alert('Data imported.');
      }
    } catch {
      alert('That file could not be read as valid Quant-OS JSON.');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle>Deadlines</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">Upcoming deadlines within 7 days automatically reduce optional self-development tasks.</p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input col-span-2" placeholder="Title (e.g. Statistics midterm)" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} />
          <input type="date" className="input" value={dl.date} onChange={(e) => setDl({ ...dl, date: e.target.value })} />
          <select className="input" value={dl.type} onChange={(e) => setDl({ ...dl, type: e.target.value as any })}>
            <option value="exam">Exam</option><option value="assignment">Assignment</option><option value="application">Application</option><option value="other">Other</option>
          </select>
        </div>
        <button className="btn-primary mt-2" onClick={addDeadline}>Add deadline</button>
        <div className="mt-3 space-y-1">
          {[...state.deadlines].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
            <div key={x.id} className="flex items-center justify-between text-sm">
              <span>{x.title} <span className="text-xs text-slate-400">· {x.date} · {x.type}</span></span>
              <button className="text-red-400" onClick={() => patch({ deadlines: state.deadlines.filter((y) => y.id !== x.id) })}>✕</button>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Settings</SectionTitle>
        <Field label="Your name"><input className="input" value={state.profileName} onChange={(e) => patch({ profileName: e.target.value })} /></Field>
        <Field label="Program start date (drives week/month position)"><input type="date" className="input" value={state.startDate} onChange={(e) => patch({ startDate: e.target.value })} /></Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportData}>⬇ Export data (JSON)</button>
          <button className="btn-ghost" onClick={() => importRef.current?.click()}>⬆ Import data (JSON)</button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
          <button className="btn-ghost text-red-500" onClick={() => { if (confirm('Reset ALL data to defaults? This cannot be undone.')) reset(); }}>Reset all data</button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {syncEnabled
            ? 'Data is cached in this browser and synced to your Supabase project so it stays up to date on every signed-in device.'
            : 'All data is stored locally in your browser (localStorage) and persists across sessions.'}
        </p>
      </Card>
      {syncEnabled && (
        <Card>
          <SectionTitle>Cloud sync</SectionTitle>
          <p className="text-sm">{SYNC_LABEL[syncStatus]}</p>
          {session?.user.email && <p className="mt-1 text-xs text-slate-400">Signed in as {session.user.email}</p>}
          <button className="btn-ghost mt-3 text-red-500" onClick={() => { if (confirm('Sign out on this device?')) signOut(); }}>Sign out</button>
        </Card>
      )}
    </div>
  );
}
