import { useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState } from '../components/ui';
import type { CareerApplication, Contact, CareerExperiment, ApplicationStatus } from '../models';
import { uid } from '../lib/id';
import { mondayOf, today } from '../lib/date';

const APP_STATUS: ApplicationStatus[] = ['researching', 'applied', 'oa', 'interview', 'offer', 'rejected'];
const STATUS_TONE: Record<ApplicationStatus, string> = { researching: 'default', applied: 'technical', oa: 'markets', interview: 'ai', offer: 'output', rejected: 'default' };

export default function Career() {
  const { state, patch } = useApp();
  const [tab, setTab] = useState<'apps' | 'contacts' | 'experiments'>('apps');
  const [editApp, setEditApp] = useState<CareerApplication | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  // Weekly target check: at least one career action this week
  const weekStart = mondayOf(today());
  const actionsThisWeek = state.tasks.filter((t) => t.date >= weekStart && t.pillar === 'career' && t.status === 'done').length
    + state.contacts.filter((c) => (c.dateContacted ?? '') >= weekStart).length;

  const saveApp = (a: CareerApplication) => {
    if (a.id) patch({ applications: state.applications.map((x) => (x.id === a.id ? a : x)) });
    else patch({ applications: [...state.applications, { ...a, id: uid('app-') }] });
    setEditApp(null);
  };
  const saveContact = (c: Contact) => {
    if (c.id) patch({ contacts: state.contacts.map((x) => (x.id === c.id ? c : x)) });
    else patch({ contacts: [...state.contacts, { ...c, id: uid('c-') }] });
    setEditContact(null);
  };
  const updateExp = (e: CareerExperiment) => patch({ experiments: state.experiments.map((x) => (x.id === e.id ? e : x)) });
  const addExp = () => patch({ experiments: [...state.experiments, { id: uid('exp-'), title: 'New experiment', status: 'planned', learned: '' }] });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Career / Networking</h1>
        <p className="text-sm text-slate-400">Increase your win-rate with deliberate, non-spam actions. Weekly target: ≥1 meaningful action.</p>
      </div>

      <Card className={actionsThisWeek > 0 ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10'}>
        <div className="flex items-center justify-between">
          <span className="text-sm">This week's career actions: <b>{actionsThisWeek}</b></span>
          <span className="text-xs">{actionsThisWeek > 0 ? '✓ Weekly target met' : '○ Do at least one meaningful action'}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Examples: message an alumnus · speak to a professor · attend an event · follow up · research one company · analyse one job description.</p>
      </Card>

      <div className="flex gap-2">
        {(['apps', 'contacts', 'experiments'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}>
            {t === 'apps' ? 'Applications' : t === 'contacts' ? 'Contacts' : 'Experiments'}
          </button>
        ))}
      </div>

      {tab === 'apps' && (
        <Card>
          <SectionTitle right={<button className="btn-primary" onClick={() => setEditApp({ id: '', company: '', role: '', status: 'researching' })}>+ Add</button>}>Applications</SectionTitle>
          {state.applications.length === 0 ? <EmptyState>No applications tracked. Add target internships/roles.</EmptyState> : (
            <div className="space-y-2">
              {state.applications.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><span className="text-sm font-semibold">{a.company}</span> <span className="text-xs text-slate-400">— {a.role}</span></div>
                    <div className="flex items-center gap-2">
                      <Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip>
                      {a.deadline && <span className="text-[10px] text-slate-400">due {a.deadline}</span>}
                      <button className="text-xs text-indigo-500 hover:underline" onClick={() => setEditApp(a)}>Edit</button>
                      <button className="text-xs text-red-400 hover:underline" onClick={() => patch({ applications: state.applications.filter((x) => x.id !== a.id) })}>✕</button>
                    </div>
                  </div>
                  {a.nextAction && <div className="mt-1 text-xs text-slate-500"><b>Next:</b> {a.nextAction}</div>}
                  {a.lessons && <div className="text-xs text-slate-400"><b>Lessons:</b> {a.lessons}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'contacts' && (
        <Card>
          <SectionTitle right={<button className="btn-primary" onClick={() => setEditContact({ id: '', name: '', type: 'alumni' })}>+ Add</button>}>Networking contacts</SectionTitle>
          {state.contacts.length === 0 ? <EmptyState>No contacts yet. Track professors, alumni, and industry people.</EmptyState> : (
            <div className="space-y-2">
              {state.contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><span className="text-sm font-semibold">{c.name}</span> <Chip>{c.type}</Chip></div>
                    <div className="flex items-center gap-2 text-xs">
                      {c.followUpDate && <span className="text-amber-500">follow up {c.followUpDate}</span>}
                      <button className="text-indigo-500 hover:underline" onClick={() => setEditContact(c)}>Edit</button>
                      <button className="text-red-400 hover:underline" onClick={() => patch({ contacts: state.contacts.filter((x) => x.id !== c.id) })}>✕</button>
                    </div>
                  </div>
                  {c.topic && <div className="mt-1 text-xs text-slate-500"><b>Topic:</b> {c.topic}</div>}
                  {c.advice && <div className="text-xs text-slate-400"><b>Advice:</b> {c.advice}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'experiments' && (
        <Card>
          <SectionTitle right={<button className="btn-primary" onClick={addExp}>+ Add</button>}>Career experiments</SectionTitle>
          <p className="mb-3 text-xs text-slate-400">After each experiment: "What did I learn about whether I like this career?"</p>
          <div className="space-y-2">
            {state.experiments.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <input className="input flex-1" value={e.title} onChange={(ev) => updateExp({ ...e, title: ev.target.value })} />
                  <select className="input w-auto" value={e.status} onChange={(ev) => updateExp({ ...e, status: ev.target.value as any })}>
                    <option value="planned">Planned</option>
                    <option value="in-progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                  <button className="text-red-400" onClick={() => patch({ experiments: state.experiments.filter((x) => x.id !== e.id) })}>✕</button>
                </div>
                <textarea className="input mt-2" placeholder="What did I learn about whether I like this career?" value={e.learned} onChange={(ev) => updateExp({ ...e, learned: ev.target.value })} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Application modal */}
      <Modal open={!!editApp} onClose={() => setEditApp(null)} title={editApp?.id ? 'Edit application' : 'New application'} wide>
        {editApp && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Company"><input className="input" value={editApp.company} onChange={(e) => setEditApp({ ...editApp, company: e.target.value })} /></Field>
            <Field label="Role"><input className="input" value={editApp.role} onChange={(e) => setEditApp({ ...editApp, role: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={editApp.status} onChange={(e) => setEditApp({ ...editApp, status: e.target.value as any })}>{APP_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
            <Field label="Deadline"><input type="date" className="input" value={editApp.deadline ?? ''} onChange={(e) => setEditApp({ ...editApp, deadline: e.target.value })} /></Field>
            <Field label="CV version"><input className="input" value={editApp.cvVersion ?? ''} onChange={(e) => setEditApp({ ...editApp, cvVersion: e.target.value })} /></Field>
            <Field label="Interview stage"><input className="input" value={editApp.interviewStage ?? ''} onChange={(e) => setEditApp({ ...editApp, interviewStage: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Next action"><input className="input" value={editApp.nextAction ?? ''} onChange={(e) => setEditApp({ ...editApp, nextAction: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Result / Lessons"><textarea className="input" value={editApp.lessons ?? ''} onChange={(e) => setEditApp({ ...editApp, lessons: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editApp.company} onClick={() => saveApp(editApp)}>Save</button></div>
          </div>
        )}
      </Modal>

      {/* Contact modal */}
      <Modal open={!!editContact} onClose={() => setEditContact(null)} title={editContact?.id ? 'Edit contact' : 'New contact'} wide>
        {editContact && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={editContact.name} onChange={(e) => setEditContact({ ...editContact, name: e.target.value })} /></Field>
            <Field label="Type"><select className="input" value={editContact.type} onChange={(e) => setEditContact({ ...editContact, type: e.target.value as any })}><option value="professor">Professor</option><option value="alumni">Alumni</option><option value="industry">Industry</option><option value="peer">Peer</option></select></Field>
            <Field label="Date contacted"><input type="date" className="input" value={editContact.dateContacted ?? ''} onChange={(e) => setEditContact({ ...editContact, dateContacted: e.target.value })} /></Field>
            <Field label="Follow-up date"><input type="date" className="input" value={editContact.followUpDate ?? ''} onChange={(e) => setEditContact({ ...editContact, followUpDate: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Topic"><input className="input" value={editContact.topic ?? ''} onChange={(e) => setEditContact({ ...editContact, topic: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Advice received"><textarea className="input" value={editContact.advice ?? ''} onChange={(e) => setEditContact({ ...editContact, advice: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editContact.name} onClick={() => saveContact(editContact)}>Save</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
