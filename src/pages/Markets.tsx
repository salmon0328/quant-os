import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { NEWS_ANALYSIS_FRAMEWORK, NEWS_BUTTONS } from '../data/newsFramework';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState } from '../components/ui';
import type { MarketJournalEntry, AssetClass } from '../models';
import { today } from '../lib/date';
import { uid } from '../lib/id';

const ASSET_CLASSES: AssetClass[] = ['equities', 'rates', 'fx', 'commodities', 'options', 'crypto'];

const emptyEntry: MarketJournalEntry = {
  id: '', date: today(), assetClasses: ['equities'], ticker: '', event: '', whatHappened: '', whyItHappened: '', myPrediction: '', actualOutcome: '', confidence: 3, lesson: '',
};

// Older entries may have a single `assetClass`; normalise to an array.
function classesOf(e: MarketJournalEntry): AssetClass[] {
  if (Array.isArray(e.assetClasses)) return e.assetClasses;
  const legacy = (e as unknown as { assetClass?: AssetClass }).assetClass;
  return legacy ? [legacy] : [];
}

export default function Markets() {
  const { state, patch } = useApp();
  const [editing, setEditing] = useState<MarketJournalEntry | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const entries = useMemo(() => {
    return [...state.journal]
      .filter((e) => filter === 'all' || classesOf(e).includes(filter as AssetClass))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.journal, filter]);

  const save = (e: MarketJournalEntry) => {
    if (e.id) patch({ journal: state.journal.map((x) => (x.id === e.id ? e : x)) });
    else patch({ journal: [...state.journal, { ...e, id: uid('j-') }] });
    setEditing(null);
  };
  const remove = (id: string) => patch({ journal: state.journal.filter((e) => e.id !== id) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Markets Today</h1>
        <p className="text-sm text-slate-400">Don't just "read the news" — analyse it with a repeatable framework, then journal it.</p>
      </div>

      {/* News source buttons */}
      <Card>
        <SectionTitle>Sources</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {NEWS_BUTTONS.map((b) => (
            <a key={b.label} href={b.url} target="_blank" rel="noreferrer" className="btn-ghost">{b.label} ↗</a>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">Priority: Bloomberg · Reuters · FT · CNBC · central banks · official releases. (Some require a subscription.)</p>
      </Card>

      {/* Analysis framework */}
      <Card>
        <SectionTitle>Daily analysis framework</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NEWS_ANALYSIS_FRAMEWORK.map((f) => (
            <div key={f.step} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{f.step}</span>
                <span className="text-sm font-semibold">{f.title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.prompt}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Market journal */}
      <Card>
        <SectionTitle right={<button className="btn-primary" onClick={() => setEditing({ ...emptyEntry, date: today() })}>+ New entry</button>}>Market Journal</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')} className={`chip ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>All</button>
          {ASSET_CLASSES.map((a) => (
            <button key={a} onClick={() => setFilter(a)} className={`chip capitalize ${filter === a ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{a}</button>
          ))}
        </div>
        {entries.length === 0 ? <EmptyState>No journal entries yet. After reading the news, record what happened and your explanation.</EmptyState> : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {classesOf(e).map((c) => <Chip key={c} tone="markets">{c}</Chip>)}
                    <span className="text-sm font-semibold">{e.ticker || '—'}</span>
                    <span className="text-xs text-slate-400">{e.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">confidence {e.confidence}/5</span>
                    <button className="text-xs text-indigo-500 hover:underline" onClick={() => setEditing(e)}>Edit</button>
                    <button className="text-xs text-red-400 hover:underline" onClick={() => remove(e.id)}>Delete</button>
                  </div>
                </div>
                <div className="mt-1 text-sm font-medium">{e.event}</div>
                <div className="mt-1 grid gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                  {e.whatHappened && <div><b>What: </b>{e.whatHappened}</div>}
                  {e.whyItHappened && <div><b>Why: </b>{e.whyItHappened}</div>}
                  {e.myPrediction && <div><b>My prediction: </b>{e.myPrediction}</div>}
                  {e.actualOutcome && <div><b>Actual: </b>{e.actualOutcome}</div>}
                  {e.lesson && <div className="sm:col-span-2 text-emerald-500"><b>Lesson: </b>{e.lesson}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit journal entry' : 'New journal entry'} wide>
        {editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Date"><input type="date" className="input" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="Confidence (1-5)"><input type="number" min={1} max={5} className="input" value={editing.confidence} onChange={(e) => setEditing({ ...editing, confidence: +e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Asset classes affected (select all that apply)">
                <div className="flex flex-wrap gap-1.5">
                  {ASSET_CLASSES.map((a) => {
                    const on = classesOf(editing).includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          const cur = classesOf(editing);
                          const next = on ? cur.filter((x) => x !== a) : [...cur, a];
                          setEditing({ ...editing, assetClasses: next });
                        }}
                        className={`chip capitalize ${on ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                      >
                        {on ? '✓ ' : ''}{a}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <Field label="Ticker / Asset"><input className="input" value={editing.ticker} onChange={(e) => setEditing({ ...editing, ticker: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Event"><input className="input" value={editing.event} onChange={(e) => setEditing({ ...editing, event: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="What happened?"><textarea className="input" value={editing.whatHappened} onChange={(e) => setEditing({ ...editing, whatHappened: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Why did it happen? (your explanation)"><textarea className="input" value={editing.whyItHappened} onChange={(e) => setEditing({ ...editing, whyItHappened: e.target.value })} /></Field></div>
            <Field label="My prediction"><textarea className="input" value={editing.myPrediction} onChange={(e) => setEditing({ ...editing, myPrediction: e.target.value })} /></Field>
            <Field label="What actually happened?"><textarea className="input" value={editing.actualOutcome} onChange={(e) => setEditing({ ...editing, actualOutcome: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Lesson"><textarea className="input" value={editing.lesson} onChange={(e) => setEditing({ ...editing, lesson: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editing.event} onClick={() => save(editing)}>Save entry</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
