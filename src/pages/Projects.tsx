import { useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, Chip, ProgressBar, Modal, Field } from '../components/ui';
import type { Project, ProjectStatus, Milestone, ProjectResource, ProjectResourceType } from '../models';
import { uid } from '../lib/id';
import { PILLARS } from '../data/pillars';

const STATUS: ProjectStatus[] = ['backlog', 'active', 'paused', 'done'];
const STATUS_TONE: Record<ProjectStatus, string> = { backlog: 'default', active: 'ai', paused: 'markets', done: 'output' };

const RESOURCE_ICON: Record<ProjectResourceType, string> = {
  repo: '⌨️', reading: '📕', guide: '🧭', dataset: '🗄️', video: '🎥', tool: '🛠️', docs: '📄',
};

const RESOURCE_TYPES: ProjectResourceType[] = ['guide', 'reading', 'repo', 'dataset', 'docs', 'tool', 'video'];

const emptyProject: Project = {
  id: '', name: '', objective: '', whyItMatters: '', skills: [], status: 'backlog', nextAction: '', milestones: [], pillars: ['finance'],
};

export default function Projects() {
  const { state, patch } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Project | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const projects = state.projects.filter((p) => filter === 'all' || p.status === filter);

  const progress = (p: Project) => (p.milestones.length ? Math.round((p.milestones.filter((m) => m.done).length / p.milestones.length) * 100) : p.status === 'done' ? 100 : 0);

  const update = (p: Project) => patch({ projects: state.projects.map((x) => (x.id === p.id ? p : x)) });
  const toggleMs = (p: Project, msId: string) => update({ ...p, milestones: p.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done } : m)) });
  const setStatus = (p: Project, s: ProjectStatus) => update({ ...p, status: s, startDate: s === 'active' && !p.startDate ? new Date().toISOString().slice(0, 10) : p.startDate });

  const save = (p: Project) => {
    const skills = typeof (p.skills as any) === 'string' ? (p.skills as any).split(',').map((s: string) => s.trim()).filter(Boolean) : p.skills;
    if (p.id) patch({ projects: state.projects.map((x) => (x.id === p.id ? { ...p, skills } : x)) });
    else patch({ projects: [...state.projects, { ...p, id: uid('p-'), skills, milestones: p.milestones }] });
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-slate-400">Output {'>'} consumption. Every project → weekly milestones and a concrete artifact.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ ...emptyProject })}>+ New project</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')} className={`chip ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>All</button>
        {STATUS.map((s) => <button key={s} onClick={() => setFilter(s)} className={`chip capitalize ${filter === s ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{s}</button>)}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</h3>
              <select value={p.status} onChange={(e) => setStatus(p, e.target.value as ProjectStatus)} className="rounded border-none bg-transparent text-xs">
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip>
              {p.effort && <Chip>{p.effort}</Chip>}
              {!!p.resources?.length && <Chip tone="output">{p.resources.length} links</Chip>}
              {p.pillars.map((pl) => { const px = PILLARS.find((x) => x.id === pl)!; return <span key={pl} className="text-[10px]" style={{ color: px.color }}>{px.name.split(' ')[0]}</span>; })}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.objective}</p>
            <p className="mt-1 text-[11px] text-slate-400"><b>Why:</b> {p.whyItMatters}</p>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>Milestones</span><span>{progress(p)}%</span></div>
              <ProgressBar value={progress(p)} />
              <div className="mt-2 space-y-1">
                {p.milestones.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" checked={m.done} onChange={() => toggleMs(p, m.id)} className="accent-indigo-500" />
                    <span className={m.done ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'}>{m.title}{m.week ? ` · wk${m.week}` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
              <b>Next action:</b> {p.nextAction}
              {p.skills.length > 0 && <div className="mt-1 text-[10px] text-slate-400">Skills: {p.skills.join(', ')}</div>}
            </div>

            <button
              onClick={() => setOpenId(openId === p.id ? null : p.id)}
              className="mt-2 text-xs text-indigo-500 hover:underline"
            >
              {openId === p.id ? 'Hide how to start' : 'How do I start? →'}
            </button>

            {openId === p.id && (
              <div className="mt-2 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {!!p.starter?.length && (
                  <div>
                    <div className="label mb-1">First 30 minutes</div>
                    <ol className="space-y-1">
                      {p.starter.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {!!p.resources?.length && (
                  <div>
                    <div className="label mb-1">Resources</div>
                    <div className="space-y-1">
                      {p.resources.map((r) => (
                        <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <span className="mt-0.5 shrink-0 text-[13px] leading-none">{RESOURCE_ICON[r.type]}</span>
                          <span className="min-w-0">
                            <span className="text-xs text-indigo-500">{r.label}</span>
                            {r.note && <span className="block text-[11px] text-slate-400">{r.note}</span>}
                          </span>
                          {r.needsCampus && <span className="ml-auto shrink-0 text-[10px] font-bold text-amber-500">CAMPUS</span>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs">
              {p.repoLink && <a href={p.repoLink} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Repo ↗</a>}
              <button className="text-slate-400 hover:underline" onClick={() => setEditing(p)}>Edit / log output</button>
            </div>
            {p.output && <div className="mt-1 text-[11px] text-emerald-500"><b>Output:</b> {p.output}</div>}
            {p.lessons && <div className="text-[11px] text-slate-400"><b>Lessons:</b> {p.lessons}</div>}
          </Card>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit project' : 'New project'} wide>
        {editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Name"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Objective"><textarea className="input" value={editing.objective} onChange={(e) => setEditing({ ...editing, objective: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Why it matters"><textarea className="input" value={editing.whyItMatters} onChange={(e) => setEditing({ ...editing, whyItMatters: e.target.value })} /></Field></div>
            <Field label="Skills (comma-separated)"><input className="input" value={Array.isArray(editing.skills) ? editing.skills.join(', ') : editing.skills} onChange={(e) => setEditing({ ...editing, skills: e.target.value as any })} /></Field>
            <Field label="Next action"><input className="input" value={editing.nextAction} onChange={(e) => setEditing({ ...editing, nextAction: e.target.value })} /></Field>
            <Field label="Target date"><input type="date" className="input" value={editing.targetDate ?? ''} onChange={(e) => setEditing({ ...editing, targetDate: e.target.value })} /></Field>
            <Field label="Repository / link"><input className="input" value={editing.repoLink ?? ''} onChange={(e) => setEditing({ ...editing, repoLink: e.target.value })} /></Field>
            <Field label="Rough effort">
              <select className="input" value={editing.effort ?? ''} onChange={(e) => setEditing({ ...editing, effort: (e.target.value || undefined) as Project['effort'] })}>
                <option value="">—</option>
                {['1 weekend', '1 week', '2-3 weeks', '1 month+'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><StarterEditor value={editing.starter ?? []} onChange={(s) => setEditing({ ...editing, starter: s })} /></div>
            <div className="sm:col-span-2"><ResourceEditor value={editing.resources ?? []} onChange={(rs) => setEditing({ ...editing, resources: rs })} /></div>
            <div className="sm:col-span-2"><Field label="Output produced"><textarea className="input" value={editing.output ?? ''} onChange={(e) => setEditing({ ...editing, output: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Lessons learned"><textarea className="input" value={editing.lessons ?? ''} onChange={(e) => setEditing({ ...editing, lessons: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><MilestoneEditor value={editing.milestones} onChange={(ms) => setEditing({ ...editing, milestones: ms })} /></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editing.name} onClick={() => save(editing)}>Save</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StarterEditor({ value, onChange }: { value: string[]; onChange: (s: string[]) => void }) {
  const [t, setT] = useState('');
  return (
    <div>
      <div className="label mb-1">First 30 minutes (how to start)</div>
      <ol className="space-y-1">
        {value.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{i + 1}.</span>
            <span className="flex-1">{s}</span>
            <button className="text-red-400" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ol>
      <div className="mt-1 flex gap-2">
        <input className="input" placeholder="Add a first step…" value={t} onChange={(e) => setT(e.target.value)} />
        <button className="btn-ghost" onClick={() => { if (t) { onChange([...value, t]); setT(''); } }}>Add</button>
      </div>
    </div>
  );
}

function ResourceEditor({ value, onChange }: { value: ProjectResource[]; onChange: (r: ProjectResource[]) => void }) {
  const blank: ProjectResource = { id: '', label: '', url: '', type: 'guide' };
  const [draft, setDraft] = useState<ProjectResource>(blank);
  return (
    <div>
      <div className="label mb-1">Resources (links, readings, repos)</div>
      <div className="space-y-1">
        {value.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="shrink-0">{RESOURCE_ICON[r.type]}</span>
            <span className="flex-1 truncate">{r.label}</span>
            <span className="truncate text-[10px] text-slate-400">{r.url}</span>
            <button className="text-red-400" onClick={() => onChange(value.filter((x) => x.id !== r.id))}>✕</button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input className="input" placeholder="Label (e.g. SciPy brentq docs)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className="input" placeholder="https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ProjectResourceType })}>
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          className="btn-ghost"
          onClick={() => { if (draft.label && draft.url) { onChange([...value, { ...draft, id: uid('pr-') }]); setDraft(blank); } }}
        >Add</button>
      </div>
    </div>
  );
}

function MilestoneEditor({ value, onChange }: { value: Milestone[]; onChange: (m: Milestone[]) => void }) {
  const [t, setT] = useState('');
  return (
    <div>
      <div className="label mb-1">Milestones</div>
      <div className="space-y-1">
        {value.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{m.title}</span>
            <button className="text-red-400" onClick={() => onChange(value.filter((x) => x.id !== m.id))}>✕</button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <input className="input" placeholder="Add milestone…" value={t} onChange={(e) => setT(e.target.value)} />
        <button className="btn-ghost" onClick={() => { if (t) { onChange([...value, { id: uid('m-'), title: t, done: false }]); setT(''); } }}>Add</button>
      </div>
    </div>
  );
}
