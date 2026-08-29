import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, EmptyState, Field } from '../components/ui';
import { today, daysBetween, mondayOf } from '../lib/date';
import { uid } from '../lib/id';
import type { Insight, InsightCategory, PillarId } from '../models';

const CATEGORIES: InsightCategory[] = ['market', 'company', 'macro', 'strategy', 'technical', 'career'];

const CAT_TONE: Record<InsightCategory, string> = {
  market: 'markets',
  company: 'finance',
  macro: 'finance',
  strategy: 'output',
  technical: 'technical',
  career: 'career',
};

const empty: Insight = {
  id: '', date: today(), title: '', source: '', sourceUrl: '', takeaway: '',
  tags: [], pillar: 'finance', category: 'market', rating: 3,
};

export default function Insights() {
  const { state, addInsight, removeInsight } = useApp();
  const [draft, setDraft] = useState<Insight>({ ...empty });
  const [cat, setCat] = useState<InsightCategory | 'all'>('all');
  const [q, setQ] = useState('');

  const all = state.insights ?? [];
  const list = useMemo(() => {
    const term = q.toLowerCase();
    return all
      .filter((i) => (cat === 'all' || i.category === cat))
      .filter((i) => !term || `${i.title} ${i.source} ${i.takeaway} ${i.tags.join(' ')}`.toLowerCase().includes(term))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [all, cat, q]);

  const thisWeek = all.filter((i) => i.date >= mondayOf(today())).length;
  const topSources = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((i) => counts.set(i.source, (counts.get(i.source) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [all]);

  const save = () => {
    if (!draft.title.trim()) return;
    addInsight({
      ...draft,
      id: uid('ins-'),
      date: today(),
      tags: draft.tags.filter(Boolean),
    });
    setDraft({ ...empty, category: draft.category, pillar: draft.pillar });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-slate-400">
          One box. Anything worth keeping from a call, a newsletter, a lecture or a chart — write it down in three lines and move on.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="label">Captured</div><div className="mt-1 text-2xl font-bold">{all.length}</div></Card>
        <Card><div className="label">This week</div><div className="mt-1 text-2xl font-bold text-indigo-500">{thisWeek}</div></Card>
        <Card><div className="label">Last 30 days</div><div className="mt-1 text-2xl font-bold text-emerald-500">{all.filter((i) => daysBetween(i.date, today()) <= 30).length}</div></Card>
      </div>

      {/* --------------------------------------------------- quick capture */}
      <Card className="border-indigo-200 dark:border-indigo-500/30">
        <SectionTitle>Quick capture</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="What's the insight?">
            <input
              className="input" placeholder="e.g. TSMC capex guidance implies…"
              value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Where did it come from?">
            <input
              className="input" placeholder="Quartr — TSMC Q2 call / Doomberg / lecture"
              value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Takeaway — what, so what, now what (3 lines max)">
              <textarea
                className="input" rows={3}
                placeholder={'What I learned:\nWhy it matters:\nWhat I do differently:'}
                value={draft.takeaway} onChange={(e) => setDraft({ ...draft, takeaway: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Category">
            <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as InsightCategory })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Pillar">
            <select className="input" value={draft.pillar} onChange={(e) => setDraft({ ...draft, pillar: e.target.value as PillarId })}>
              {['finance', 'ai', 'programming', 'research', 'career', 'academics'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tags (comma-separated)">
              <input className="input" placeholder="semis, capex, taiwan" value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((s) => s.trim()) })} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="label mb-0">Worth it?</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setDraft({ ...draft, rating: n })} className={`chip ${(draft.rating ?? 0) >= n ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{n}</button>
              ))}
            </div>
            <button className="btn-primary" disabled={!draft.title.trim()} onClick={save}>Save insight</button>
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------- filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setCat('all')} className={`chip ${cat === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip capitalize ${cat === c ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{c}</button>
        ))}
        <input className="input ml-auto w-full sm:w-56" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {topSources.length > 0 && (
        <Card>
          <div className="label mb-2">Where your best inputs come from</div>
          <div className="flex flex-wrap gap-1.5">
            {topSources.map(([s, n]) => <Chip key={s}>{s} · {n}</Chip>)}
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState>
          Nothing captured yet. Read one thing today and write three lines.{' '}
          <Link to="/research" className="text-indigo-500 hover:underline">Deep paper template →</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((i) => (
            <Card key={i.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{i.title}</span>
                <div className="flex items-center gap-2">
                  <Chip tone={CAT_TONE[i.category]}>{i.category}</Chip>
                  {i.rating ? <span className="text-[10px] text-amber-500">{'★'.repeat(i.rating)}</span> : null}
                </div>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {i.date} · {i.source}
              </div>
              {i.takeaway && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{i.takeaway}</p>}
              {i.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {i.tags.map((t) => <span key={t} className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{t}</span>)}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {i.sourceUrl && <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Source ↗</a>}
                <button className="text-slate-400 hover:underline" onClick={() => { removeInsight(i.id); }}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
