import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState } from '../components/ui';
import type { KnowledgeEntry } from '../models';
import { dueForReview, srsActionFor, SRS_INTERVALS } from '../engine/spacedRepetition';
import { today, daysBetween } from '../lib/date';
import { uid } from '../lib/id';

const empty: KnowledgeEntry = {
  id: '', concept: '', category: 'Finance', definition: '', intuition: '', formula: '', example: '', commonMistake: '', related: [], srsStage: 0, nextReview: today(),
};

export default function Knowledge() {
  const { state, patch, reviewKnowledge } = useApp();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [view, setView] = useState<KnowledgeEntry | null>(null);

  const due = dueForReview(state.knowledge, today());
  const list = useMemo(() => state.knowledge.filter((e) => `${e.concept} ${e.category} ${e.definition}`.toLowerCase().includes(q.toLowerCase())), [state.knowledge, q]);

  const save = (e: KnowledgeEntry) => {
    if (e.id) patch({ knowledge: state.knowledge.map((x) => (x.id === e.id ? e : x)) });
    else patch({ knowledge: [...state.knowledge, { ...e, id: uid('k-'), related: typeof (e.related as any) === 'string' ? (e.related as any).split(',').map((s: string) => s.trim()) : e.related }] });
    setEditing(null);
  };
  const remove = (id: string) => patch({ knowledge: state.knowledge.filter((e) => e.id !== id) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-slate-400">Concept cards with spaced repetition ({SRS_INTERVALS.join('/')} day intervals).</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ ...empty })}>+ New concept</button>
      </div>

      {due.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/60 dark:border-pink-500/30 dark:bg-pink-500/10">
          <SectionTitle>Due for review ({due.length})</SectionTitle>
          <div className="space-y-2">
            {due.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{e.concept}</div>
                  <div className="text-xs text-slate-400">Stage {e.srsStage} · Action: {srsActionFor(e)}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost text-red-500" onClick={() => reviewKnowledge(e.id, false)}>Forgot</button>
                  <button className="btn-primary" onClick={() => reviewKnowledge(e.id, true)}>Remembered</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <input className="input" placeholder="Search concepts…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <button key={e.id} onClick={() => setView(e)} className="card text-left transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{e.concept}</span>
              <Chip>{e.category}</Chip>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{e.definition}</p>
            <div className="mt-2 text-[10px] text-slate-400">
              {e.nextReview ? `Next review in ${Math.max(0, daysBetween(today(), e.nextReview))}d` : 'Not scheduled'} · stage {e.srsStage}
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 && <EmptyState>No concepts yet.</EmptyState>}

      {/* View modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.concept ?? ''} wide>
        {view && (
          <div className="space-y-2 text-sm">
            <Chip>{view.category}</Chip>
            <Row k="Definition" v={view.definition} />
            <Row k="Intuition" v={view.intuition} />
            {view.formula && <Row k="Formula" v={view.formula} mono />}
            <Row k="Example" v={view.example} />
            <Row k="Common mistake" v={view.commonMistake} />
            {view.related.length > 0 && <Row k="Related" v={view.related.join(', ')} />}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost text-red-500" onClick={() => { remove(view.id); setView(null); }}>Delete</button>
              <button className="btn-ghost" onClick={() => { setEditing(view); setView(null); }}>Edit</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit concept' : 'New concept'} wide>
        {editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Concept"><input className="input" value={editing.concept} onChange={(e) => setEditing({ ...editing, concept: e.target.value })} /></Field>
            <Field label="Category"><input className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Definition"><textarea className="input" value={editing.definition} onChange={(e) => setEditing({ ...editing, definition: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Intuition"><textarea className="input" value={editing.intuition} onChange={(e) => setEditing({ ...editing, intuition: e.target.value })} /></Field></div>
            <Field label="Formula"><input className="input" value={editing.formula} onChange={(e) => setEditing({ ...editing, formula: e.target.value })} /></Field>
            <Field label="Related (comma-separated)"><input className="input" value={Array.isArray(editing.related) ? editing.related.join(', ') : editing.related} onChange={(e) => setEditing({ ...editing, related: e.target.value as any })} /></Field>
            <div className="sm:col-span-2"><Field label="Example"><textarea className="input" value={editing.example} onChange={(e) => setEditing({ ...editing, example: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Common mistake"><textarea className="input" value={editing.commonMistake} onChange={(e) => setEditing({ ...editing, commonMistake: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editing.concept} onClick={() => save(editing)}>Save</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className={`text-slate-700 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{v}</div>
    </div>
  );
}
