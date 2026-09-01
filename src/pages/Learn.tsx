import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppState';
import { PILLARS } from '../data/pillars';
import type { Lesson, LessonDifficulty, PracticeQuestion, VideoLink, LessonSource, PillarId } from '../models';
import { Card, Chip, ProgressBar, Modal, Field, EmptyState } from '../components/ui';

type RichBlock = { type: 'p' | 'ul'; items: string[] };

function renderRich(blocks: RichBlock[]) {
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i} className="list-disc space-y-1 pl-5">
        {b.items.map((it, j) => (
          <li key={j}>{it}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {b.items[0]}
      </p>
    )
  );
}

function toBlocks(text: string): RichBlock[] {
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((para): RichBlock => {
      const lines = para.split('\n');
      if (lines.length > 1 && lines.every((l) => /^- /.test(l.trim()))) {
        return { type: 'ul', items: lines.map((l) => l.trim().replace(/^- /, '')) };
      }
      return { type: 'p', items: [para] };
    });
}

function RichText({ text }: { text: string }) {
  return <div className="space-y-3">{renderRich(toBlocks(text))}</div>;
}

const DIFF_TONE: Record<LessonDifficulty, string> = {
  beginner: 'academics',
  intermediate: 'programming',
  advanced: 'finance',
};

function newLesson(trackId: PillarId): Lesson {
  return {
    id: `usr-${Date.now()}`,
    trackId,
    title: '',
    summary: '',
    difficulty: 'beginner',
    tags: [],
    elaboration: '',
    keyNotes: [],
    practice: [],
    videos: [],
    sources: [],
    estMinutes: 10,
    order: 999,
    createdAt: new Date().toISOString(),
  };
}

export default function Learn() {
  const { state, addLesson, updateLesson, removeLesson, patch } = useApp();
  const lessons = state.lessons ?? [];
  const progress = state.learnProgress ?? {};

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const byPillar = useMemo(() => {
    return PILLARS.map((p) => ({
      pillar: p,
      items: lessons
        .filter((l) => l.trackId === p.id)
        .sort((a, b) => a.order - b.order),
    })).filter((g) => g.items.length > 0);
  }, [lessons]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;

  const toggleComplete = (id: string) =>
    patch({ learnProgress: { ...progress, [id]: !progress[id] } });

  const openNew = () => {
    setDraft(newLesson((selected?.trackId ?? byPillar[0]?.pillar.id ?? 'finance') as PillarId));
    setEditorOpen(true);
  };
  const openEdit = (l: Lesson) => {
    setDraft({ ...l, keyNotes: [...l.keyNotes], practice: l.practice.map((x) => ({ ...x })), videos: l.videos.map((v) => ({ ...v })), sources: l.sources.map((s) => ({ ...s })) });
    setEditorOpen(true);
  };

  const saveDraft = () => {
    if (!draft || !draft.title.trim()) return;
    const existing = lessons.some((l) => l.id === draft.id);
    if (existing) updateLesson(draft);
    else addLesson(draft);
    setEditorOpen(false);
    setDraft(null);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const arr: Lesson[] = Array.isArray(raw) ? raw : raw.lessons ?? [];
      let n = 0;
      for (const l of arr) {
        if (l && l.title && l.trackId) {
          addLesson({ ...l, id: l.id?.startsWith('usr-') ? l.id : `usr-${Date.now()}-${n}`, order: l.order ?? 999 });
          n++;
        }
      }
      setImportMsg(`Imported ${n} lesson${n === 1 ? '' : 's'}.`);
    } catch {
      setImportMsg('Could not parse that file — expected a JSON array of lessons.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Learn</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            A one-stop reader that teaches each concept in depth — elaboration, key notes, practice
            questions, and curated video/source links. Add your own lessons, or generate a whole
            library from your books with <code className="text-xs">scripts/generate_lessons.py</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import .json</button>
          <button className="btn btn-primary" onClick={openNew}>+ New lesson</button>
        </div>
      </div>

      {importMsg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          {importMsg}
        </div>
      )}

      {byPillar.length === 0 && (
        <EmptyState>No lessons yet — add one, import a JSON, or generate from your reading list.</EmptyState>
      )}

      {byPillar.map(({ pillar, items }) => {
        const done = items.filter((l) => progress[l.id]).length;
        return (
          <Card key={pillar.id} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: pillar.color }} />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{pillar.name}</h2>
                <span className="text-xs text-slate-400">{done}/{items.length}</span>
              </div>
              <div className="w-40">
                <ProgressBar value={(done / Math.max(1, items.length)) * 100} color={pillar.color} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className="group rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:shadow-sm dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{l.title}</div>
                    {progress[l.id] && <span className="text-emerald-500">✓</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{l.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Chip tone={DIFF_TONE[l.difficulty]}>{l.difficulty}</Chip>
                    <span className="text-xs text-slate-400">· {l.estMinutes} min</span>
                    {l.tags.slice(0, 3).map((t) => (
                      <span key={t} className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{t}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Lesson reader */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected?.title ?? ''} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={DIFF_TONE[selected.difficulty]}>{selected.difficulty}</Chip>
              <span className="text-xs text-slate-400">~{selected.estMinutes} min</span>
              {selected.tags.map((t) => (
                <span key={t} className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{t}</span>
              ))}
            </div>
            <p className="text-sm italic text-slate-500 dark:text-slate-400">{selected.summary}</p>

            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Elaboration</h3>
              <RichText text={selected.elaboration} />
            </section>

            {selected.keyNotes.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Key notes</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {selected.keyNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </section>
            )}

            {selected.practice.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Practice questions</h3>
                <div className="space-y-2">
                  {selected.practice.map((pq, i) => (
                    <PracticeRow key={i} pq={pq} />
                  ))}
                </div>
              </section>
            )}

            {selected.videos.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Videos</h3>
                <ul className="space-y-1 text-sm">
                  {selected.videos.map((v, i) => (
                    <li key={i}>
                      <a className="text-indigo-600 hover:underline dark:text-indigo-400" href={v.url} target="_blank" rel="noreferrer">
                        ▶ {v.title}{v.minutes ? ` (${v.minutes}m)` : ''}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selected.sources.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
                <ul className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                  {selected.sources.map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a className="hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                      ) : (
                        s.label
                      )}
                      {s.note ? ` — ${s.note}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="flex gap-2">
                {!selected.id.startsWith('ls-') && (
                  <>
                    <button className="btn btn-ghost" onClick={() => openEdit(selected)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => { removeLesson(selected.id); setSelectedId(null); }}>Delete</button>
                  </>
                )}
              </div>
              <button
                className={progress[selected.id] ? 'btn btn-ghost' : 'btn btn-primary'}
                onClick={() => toggleComplete(selected.id)}
              >
                {progress[selected.id] ? 'Mark incomplete' : 'Mark complete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Lesson editor */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={draft?.id && lessons.some((l) => l.id === draft.id) ? 'Edit lesson' : 'New lesson'} wide>
        {draft && (
          <LessonEditor
            draft={draft}
            setDraft={setDraft}
            onCancel={() => { setEditorOpen(false); setDraft(null); }}
            onSave={saveDraft}
          />
        )}
      </Modal>
    </div>
  );
}

function PracticeRow({ pq }: { pq: PracticeQuestion }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const hit = typed.trim().length > 0 && pq.a.toLowerCase().includes(typed.trim().toLowerCase().slice(0, 12));
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Q: {pq.q}</div>
      <textarea
        className="input mt-2 w-full"
        rows={2}
        placeholder="Type your answer, then reveal to compare…"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      {open ? (
        <div className="mt-2 rounded bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="font-semibold">A:</span> {pq.a}
        </div>
      ) : (
        <button className="btn btn-ghost mt-2" onClick={() => setOpen(true)}>Reveal answer</button>
      )}
      {typed.trim() && !open && (
        <div className="mt-1 text-xs text-slate-400">{hit ? 'Looks on track — reveal to confirm.' : 'Reveal to compare with the model answer.'}</div>
      )}
    </div>
  );
}

function LessonEditor({
  draft, setDraft, onCancel, onSave,
}: {
  draft: Lesson;
  setDraft: (l: Lesson) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<Lesson>) => setDraft({ ...draft, ...patch });
  const setList = <K extends keyof Lesson>(key: K, value: Lesson[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <Field label="Track">
        <select className="input" value={draft.trackId} onChange={(e) => set({ trackId: e.target.value as PillarId })}>
          {PILLARS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Put-Call Parity" />
      </Field>
      <Field label="One-line summary">
        <input className="input" value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Difficulty">
          <select className="input" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as LessonDifficulty })}>
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </Field>
        <Field label="Est. minutes">
          <input className="input" type="number" value={draft.estMinutes} onChange={(e) => set({ estMinutes: Number(e.target.value) || 10 })} />
        </Field>
      </div>
      <Field label="Tags (comma-separated)">
        <input className="input" value={draft.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Elaboration (use blank lines between paragraphs; lines starting with “- ” become bullets)">
        <textarea className="input" rows={8} value={draft.elaboration} onChange={(e) => set({ elaboration: e.target.value })} />
      </Field>
      <Field label="Key notes (one per line)">
        <textarea className="input" rows={4} value={draft.keyNotes.join('\n')} onChange={(e) => set({ keyNotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
      </Field>

      <Field label="Practice questions">
        {draft.practice.map((pq, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="input" placeholder="Question" value={pq.q} onChange={(e) => setList('practice', draft.practice.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <input className="input" placeholder="Answer" value={pq.a} onChange={(e) => setList('practice', draft.practice.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            <button className="btn btn-ghost" onClick={() => setList('practice', draft.practice.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setList('practice', [...draft.practice, { q: '', a: '' }])}>+ Add question</button>
      </Field>

      <Field label="Videos (YouTube links)">
        {draft.videos.map((v, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_2fr_auto] gap-2">
            <input className="input" placeholder="Title" value={v.title} onChange={(e) => setList('videos', draft.videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <input className="input" placeholder="URL" value={v.url} onChange={(e) => setList('videos', draft.videos.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <button className="btn btn-ghost" onClick={() => setList('videos', draft.videos.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setList('videos', [...draft.videos, { title: '', url: '' } as VideoLink])}>+ Add video</button>
      </Field>

      <Field label="Sources">
        {draft.sources.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-[2fr_2fr_auto] gap-2">
            <input className="input" placeholder="Label" value={s.label} onChange={(e) => setList('sources', draft.sources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input className="input" placeholder="URL (optional)" value={s.url ?? ''} onChange={(e) => setList('sources', draft.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <button className="btn btn-ghost" onClick={() => setList('sources', draft.sources.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setList('sources', [...draft.sources, { label: '' } as LessonSource])}>+ Add source</button>
      </Field>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!draft.title.trim()}>Save lesson</button>
      </div>
    </div>
  );
}
