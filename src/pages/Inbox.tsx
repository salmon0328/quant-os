import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, Chip, EmptyState, Field, Modal } from '../components/ui';
import { FEED_SOURCES } from '../data/feedSources';
import { today, WEEKDAY_NAMES } from '../lib/date';
import { uid } from '../lib/id';
import { isCampusDay } from '../engine/scheduler';
import type { FeedItem, FeedSource, FeedType, PillarId } from '../models';

const TYPE_TONE: Record<FeedType, string> = {
  substack: 'output',
  podcast: 'ai',
  earnings: 'finance',
  news: 'markets',
  paper: 'research',
  video: 'technical',
  terminal: 'career',
};

const TYPE_LABEL: Record<FeedType, string> = {
  substack: 'Substack',
  podcast: 'Podcast',
  earnings: 'Earnings',
  news: 'News',
  paper: 'Paper',
  video: 'Video',
  terminal: 'Terminal',
};

export default function Inbox() {
  const { state, addFeedItem, setFeedStatus, removeFeedItem } = useApp();
  const [tab, setTab] = useState<'queue' | 'sources'>('queue');
  const [filter, setFilter] = useState<FeedType | 'all'>('all');
  const [adding, setAdding] = useState<FeedItem | null>(null);

  const onCampus = isCampusDay(state.schedule, today());
  const queue = (state.feed ?? []).filter((f) => f.status === 'inbox');
  const done = (state.feed ?? []).filter((f) => f.status === 'done');

  const visible = queue.filter((f) => filter === 'all' || f.type === filter);
  const totalMin = queue.reduce((a, f) => a + f.estMinutes, 0);

  const types = useMemo(() => {
    const counts = new Map<FeedType, number>();
    queue.forEach((f) => counts.set(f.type, (counts.get(f.type) ?? 0) + 1));
    return [...counts.entries()];
  }, [queue]);

  const openAdd = (src?: FeedSource) => {
    setAdding({
      id: '',
      title: src ? `${src.name} — ${WEEKDAY_NAMES[new Date().getDay()]} ${today().slice(5)}` : '',
      type: src?.type ?? 'substack',
      url: src?.url ?? '',
      source: src?.name ?? '',
      estMinutes: src?.defaultMinutes ?? 20,
      pillar: src?.pillar ?? 'finance',
      status: 'inbox',
      addedAt: today(),
      needsCampus: src?.needsCampus,
    });
  };

  const save = (f: FeedItem) => {
    addFeedItem({ ...f, id: uid('f-'), addedAt: today() });
    setAdding(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-slate-400">One queue for everything you want to read, watch or listen to. The daily pull takes one item from here.</p>
        </div>
        <button className="btn-primary" onClick={() => openAdd()}>+ Add item</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="label">In queue</div><div className="mt-1 text-2xl font-bold">{queue.length}</div></Card>
        <Card><div className="label">Time to clear</div><div className="mt-1 text-2xl font-bold text-indigo-500">{Math.round((totalMin / 60) * 10) / 10}<span className="text-sm font-normal text-slate-400">h</span></div></Card>
        <Card><div className="label">Consumed</div><div className="mt-1 text-2xl font-bold text-emerald-500">{done.length}</div></Card>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setTab('queue')} className={`chip ${tab === 'queue' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Queue</button>
        <button onClick={() => setTab('sources')} className={`chip ${tab === 'sources' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Sources</button>
      </div>

      {tab === 'queue' ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter('all')} className={`chip ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All {queue.length}</button>
            {types.map(([t, n]) => (
              <button key={t} onClick={() => setFilter(t)} className={`chip ${filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {TYPE_LABEL[t]} {n}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState>
              Queue is empty. Head to <b>Sources</b> and pull in this week's episode/newsletter.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {visible.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{f.title}</span>
                        <Chip tone={TYPE_TONE[f.type]}>{TYPE_LABEL[f.type]}</Chip>
                        <span className="text-xs text-slate-400">{f.estMinutes}m</span>
                        {f.needsCampus && <span className="text-[10px] font-bold text-amber-500">CAMPUS</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">{f.source}</div>
                      {f.notes && <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">{f.notes}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Open ↗</a>}
                      <button className="text-xs text-emerald-500 hover:underline" onClick={() => setFeedStatus(f.id, 'done')}>Done</button>
                      <button className="text-xs text-slate-400 hover:underline" onClick={() => setFeedStatus(f.id, 'archived')}>Archive</button>
                      <button className="text-xs text-red-400 hover:underline" onClick={() => removeFeedItem(f.id)}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {FEED_SOURCES.map((src) => (
            <Card key={src.id} className={src.needsCampus && !onCampus ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{src.name}</span>
                    <Chip tone={TYPE_TONE[src.type]}>{TYPE_LABEL[src.type]}</Chip>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{src.cadence} · ~{src.defaultMinutes}m</div>
                </div>
                <button className="btn-ghost shrink-0" onClick={() => openAdd(src)}>+ Queue</button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{src.note}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <a href={src.url} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Open source ↗</a>
                {src.needsCampus && <span className="text-amber-500">{onCampus ? 'available today' : 'campus only'}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Queue an item">
        {adding && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title"><input className="input" autoFocus value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></Field>
            </div>
            <Field label="Source"><input className="input" value={adding.source} onChange={(e) => setAdding({ ...adding, source: e.target.value })} /></Field>
            <Field label="Type">
              <select className="input" value={adding.type} onChange={(e) => setAdding({ ...adding, type: e.target.value as FeedType })}>
                {(Object.keys(TYPE_LABEL) as FeedType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Link"><input className="input" value={adding.url ?? ''} onChange={(e) => setAdding({ ...adding, url: e.target.value })} /></Field></div>
            <Field label="Minutes">
              <input type="number" min={5} max={180} className="input" value={adding.estMinutes} onChange={(e) => setAdding({ ...adding, estMinutes: +e.target.value })} />
            </Field>
            <Field label="Pillar">
              <select className="input" value={adding.pillar} onChange={(e) => setAdding({ ...adding, pillar: e.target.value as PillarId })}>
                {['finance', 'ai', 'programming', 'research', 'career', 'academics'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
              <button className="btn-primary" disabled={!adding.title} onClick={() => save(adding)}>Add to queue</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
