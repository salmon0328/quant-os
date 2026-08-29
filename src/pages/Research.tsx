import { useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Modal, Field, EmptyState } from '../components/ui';
import type { PaperNote } from '../models';
import { today } from '../lib/date';
import { uid } from '../lib/id';

const TEMPLATE_FIELDS: { key: keyof PaperNote; label: string }[] = [
  { key: 'researchQuestion', label: '1. Research question' },
  { key: 'whyMatters', label: '2. Why does it matter?' },
  { key: 'dataset', label: '3. Dataset' },
  { key: 'method', label: '4. Method' },
  { key: 'baseline', label: '5. Baseline' },
  { key: 'mainResult', label: '6. Main result' },
  { key: 'evaluation', label: '7. Evaluation methodology' },
  { key: 'weaknesses', label: '8. Weaknesses' },
  { key: 'whatIWouldChange', label: '9. What I would change' },
  { key: 'followUp', label: '10. Potential follow-up research question' },
];

const emptyPaper: PaperNote = {
  id: '', title: '', link: '', date: today(),
  researchQuestion: '', whyMatters: '', dataset: '', method: '', baseline: '', mainResult: '', evaluation: '', weaknesses: '', whatIWouldChange: '', followUp: '',
};

const METHOD_STEPS = [
  'Read papers', 'Identify research questions', 'Formulate hypotheses', 'Design experiments',
  'Construct datasets', 'Build baselines', 'Perform ablation studies', 'Evaluate models',
  'Conduct statistical tests', 'Avoid data leakage', 'Avoid look-ahead bias', 'Out-of-sample testing',
  'Write research findings', 'Critique papers', 'Identify research gaps',
];

export default function Research() {
  const { state, patch } = useApp();
  const [editing, setEditing] = useState<PaperNote | null>(null);
  const [view, setView] = useState<PaperNote | null>(null);

  const save = (p: PaperNote) => {
    if (p.id) patch({ papers: state.papers.map((x) => (x.id === p.id ? p : x)) });
    else patch({ papers: [...state.papers, { ...p, id: uid('pap-') }] });
    setEditing(null);
  };
  const remove = (id: string) => patch({ papers: state.papers.filter((p) => p.id !== id) });

  const completeness = (p: PaperNote) => Math.round((TEMPLATE_FIELDS.filter((f) => (p[f.key] as string)?.trim()).length / TEMPLATE_FIELDS.length) * 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Research</h1>
          <p className="text-sm text-slate-400">Never just "read" a paper — every paper produces notes via the 10-point template.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ ...emptyPaper, date: today() })}>+ New paper note</button>
      </div>

      <Card>
        <SectionTitle>Research skill checklist</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {METHOD_STEPS.map((s) => <span key={s} className="chip bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">{s}</span>)}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {state.papers.map((p) => (
          <button key={p.id} onClick={() => setView(p)} className="card text-left transition-all hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.title}</span>
              <span className="text-xs text-slate-400">{completeness(p)}%</span>
            </div>
            <div className="text-xs text-slate-400">{p.date}</div>
            {p.researchQuestion && <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400"><b>Q:</b> {p.researchQuestion}</p>}
          </button>
        ))}
      </div>
      {state.papers.length === 0 && <EmptyState>No paper notes yet. Use the template to critique your first paper (arXiv / Papers With Code in Resources).</EmptyState>}

      {/* View */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title ?? ''} wide>
        {view && (
          <div className="space-y-2 text-sm">
            {view.link && <a href={view.link} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Open paper ↗</a>}
            {TEMPLATE_FIELDS.map((f) => (view[f.key] as string)?.trim() ? (
              <div key={f.key}><div className="label">{f.label}</div><div className="text-slate-700 dark:text-slate-200">{view[f.key] as string}</div></div>
            ) : null)}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost text-red-500" onClick={() => { remove(view.id); setView(null); }}>Delete</button>
              <button className="btn-ghost" onClick={() => { setEditing(view); setView(null); }}>Edit</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit paper note' : 'New paper note'} wide>
        {editing && (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Title"><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Link"><input className="input" value={editing.link} onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></Field>
            </div>
            {TEMPLATE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <textarea className="input" value={editing[f.key] as string} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
              </Field>
            ))}
            <div className="flex justify-end"><button className="btn-primary" disabled={!editing.title} onClick={() => save(editing)}>Save note</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
