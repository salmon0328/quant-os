import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { SUBJECTS } from '../data/syllabus';
import { MODULES, modulesFor, isWritten, unmetPrereqs } from '../data/modules';
import { LEETCODE, leetcodeUrl, neetcodeUrl } from '../data/tracks/leetcode';
import { BOOK_BY_ID, chaptersOf } from '../data/books';
import type { Module, SubjectId } from '../models';
import { Card, Chip, ProgressBar, Modal, EmptyState, SectionTitle } from '../components/ui';
import { CodeRunner } from '../components/CodeRunner';
import { Quiz } from '../components/Quiz';
import { RichText } from '../components/RichText';

const DIFF_TONE: Record<string, string> = {
  beginner: 'academics',
  intermediate: 'programming',
  advanced: 'finance',
};

type Tab = 'lesson' | 'quiz' | 'practice' | 'links';

export default function Learn() {
  const { state, patch, recordQuiz } = useApp();
  const progress = state.learnProgress ?? {};
  const [openId, setOpenId] = useState<string | null>(null);
  const [subject, setSubject] = useState<SubjectId | 'all'>('all');

  const open = openId ? MODULES.find((m) => m.id === openId) ?? null : null;

  const subjects = useMemo(
    () => SUBJECTS.filter((s) => subject === 'all' || s.id === subject).sort((a, b) => a.order - b.order),
    [subject]
  );

  const doneCount = MODULES.filter((m) => progress[m.id]).length;
  const writtenCount = MODULES.filter(isWritten).length;

  const toggleDone = (id: string) => patch({ learnProgress: { ...progress, [id]: !progress[id] } });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Learn</h1>
        <p className="text-sm text-slate-400">
          One place for the technical ground a quant or markets role needs — read it, get quizzed on
          it, then write code against it. Algorithms link straight through to the exact LeetCode
          problems.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="label">Modules done</div><div className="mt-1 text-2xl font-bold text-emerald-500">{doneCount}<span className="text-sm font-normal text-slate-400">/{MODULES.length}</span></div></Card>
        <Card><div className="label">Subjects</div><div className="mt-1 text-2xl font-bold">{SUBJECTS.length}</div></Card>
        <Card><div className="label">With content</div><div className="mt-1 text-2xl font-bold text-indigo-500">{writtenCount}<span className="text-sm font-normal text-slate-400">/{MODULES.length}</span></div></Card>
      </div>

      {writtenCount === 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The syllabus is here but the lessons are not written yet. Run{' '}
            <code className="text-xs">python3 scripts/generate_modules.py</code> to fill them in.
            Module links, prerequisites and LeetCode connections all work meanwhile.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setSubject('all')} className={`chip ${subject === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All</button>
        {SUBJECTS.map((s) => (
          <button key={s.id} onClick={() => setSubject(s.id)} className={`chip ${subject === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {subjects.map((s) => {
        const mods = modulesFor(s.id);
        const done = mods.filter((m) => progress[m.id]).length;
        return (
          <Card key={s.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{s.icon} {s.name}</h2>
                <p className="text-xs text-slate-400">{s.blurb}</p>
              </div>
              <div className="w-40">
                <div className="mb-1 text-right text-xs text-slate-400">{done}/{mods.length}</div>
                <ProgressBar value={(done / Math.max(1, mods.length)) * 100} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {mods.map((m) => {
                const blocked = unmetPrereqs(m, progress);
                return (
                  <button
                    key={m.id}
                    onClick={() => setOpenId(m.id)}
                    className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:shadow-sm dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{m.title}</span>
                      {progress[m.id] && <span className="text-emerald-500">✓</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{m.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Chip tone={DIFF_TONE[m.difficulty]}>{m.difficulty}</Chip>
                      <span className="text-[10px] text-slate-400">{m.estMinutes}m</span>
                      {m.quiz.length > 0 && <span className="text-[10px] text-indigo-400">{m.quiz.length} quiz</span>}
                      {m.exercises.length > 0 && <span className="text-[10px] text-emerald-500">{m.exercises.length} code</span>}
                      {m.leetcodeIds.length > 0 && <span className="text-[10px] text-amber-500">{m.leetcodeIds.length} LC</span>}
                      {!isWritten(m) && <span className="text-[10px] text-slate-400">outline only</span>}
                    </div>
                    {blocked.length > 0 && (
                      <p className="mt-1 text-[10px] text-amber-500">First: {blocked.map((b) => b.title).join(', ')}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}

      <ModuleModal
        module={open}
        done={!!(open && progress[open.id])}
        onClose={() => setOpenId(null)}
        onToggleDone={() => open && toggleDone(open.id)}
        onQuizFinish={(r) => open && recordQuiz(open.id, r)}
      />
    </div>
  );
}

function ModuleModal({
  module: mod, done, onClose, onToggleDone, onQuizFinish,
}: {
  module: Module | null;
  done: boolean;
  onClose: () => void;
  onToggleDone: () => void;
  onQuizFinish: (r: { correct: number; total: number; ms: number; missedIds: string[]; concepts: string[] }) => void;
}) {
  const [tab, setTab] = useState<Tab>('lesson');
  if (!mod) return null;

  const problems = mod.leetcodeIds
    .map((id) => LEETCODE.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const TABS: { key: Tab; label: string; n?: number }[] = [
    { key: 'lesson', label: 'Lesson' },
    { key: 'quiz', label: 'Quiz', n: mod.quiz.length },
    { key: 'practice', label: 'Practice', n: mod.exercises.length + problems.length },
    { key: 'links', label: 'Sources' },
  ];

  return (
    <Modal open onClose={onClose} title={mod.title} wide>
      <div className="max-h-[74vh] space-y-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={DIFF_TONE[mod.difficulty]}>{mod.difficulty}</Chip>
          <span className="text-xs text-slate-400">~{mod.estMinutes} min</span>
          {mod.tags.map((t) => (
            <span key={t} className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{t}</span>
          ))}
        </div>
        <p className="text-sm italic text-slate-500 dark:text-slate-400">{mod.summary}</p>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`chip ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
            >
              {t.label}{t.n !== undefined && t.n > 0 ? ` (${t.n})` : ''}
            </button>
          ))}
        </div>

        {tab === 'lesson' && (
          mod.elaboration ? (
            <div className="space-y-4">
              <RichText text={mod.elaboration} />
              {mod.keyNotes.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Key notes</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {mod.keyNotes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </section>
              )}
              {mod.glossary.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Glossary</h3>
                  <dl className="space-y-1.5 text-sm">
                    {mod.glossary.map((g) => (
                      <div key={g.term}>
                        <dt className="font-medium text-slate-700 dark:text-slate-200">{g.term}</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{g.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          ) : (
            <EmptyState>
              Not written yet — run <code className="text-xs">scripts/generate_modules.py</code>.
              The practice links below work regardless.
            </EmptyState>
          )
        )}

        {tab === 'quiz' && <Quiz key={mod.id} module={mod} onFinish={onQuizFinish} />}

        {tab === 'practice' && (
          <div className="space-y-4">
            {problems.length > 0 && (
              <section>
                <SectionTitle>LeetCode</SectionTitle>
                <div className="space-y-1.5">
                  {problems.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
                      <span className="font-medium">{p.title}</span>
                      <Chip tone={p.difficulty === 'easy' ? 'academics' : p.difficulty === 'medium' ? 'programming' : 'finance'}>{p.difficulty}</Chip>
                      <a className="text-xs text-indigo-500 hover:underline" href={leetcodeUrl(p)} target="_blank" rel="noreferrer">LeetCode ↗</a>
                      <a className="text-xs text-indigo-500 hover:underline" href={neetcodeUrl(p)} target="_blank" rel="noreferrer">NeetCode ↗</a>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {mod.exercises.length > 0 ? (
              <section className="space-y-3">
                <SectionTitle>Code exercises</SectionTitle>
                {mod.exercises.map((e) => <CodeRunner key={e.id} exercise={e} />)}
              </section>
            ) : problems.length === 0 ? (
              <EmptyState>No practice for this module yet.</EmptyState>
            ) : null}
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-4 text-sm">
            {mod.bookRefs.length > 0 && (
              <section>
                <SectionTitle>Read alongside</SectionTitle>
                <ul className="space-y-1">
                  {mod.bookRefs.map((r) => {
                    const book = BOOK_BY_ID.get(r.bookId);
                    if (!book) return null;
                    const chapter = chaptersOf(r.bookId).find((c) => c.chapter === r.chapter);
                    return (
                      <li key={`${r.bookId}-${r.chapter}`} className="text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{book.title}</span>
                        {chapter ? ` — Ch.${chapter.chapter}: ${chapter.title}` : ''}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {mod.videos.length > 0 && (
              <section>
                <SectionTitle>Videos</SectionTitle>
                <ul className="space-y-1">
                  {mod.videos.map((v, i) => (
                    <li key={i}>
                      <a className="text-indigo-500 hover:underline" href={v.url} target="_blank" rel="noreferrer">▶ {v.title}</a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {mod.sources.length > 0 && (
              <section>
                <SectionTitle>Sources</SectionTitle>
                <ul className="space-y-1 text-slate-500 dark:text-slate-400">
                  {mod.sources.map((s, i) => (
                    <li key={i}>{s.url ? <a className="hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}{s.note ? ` — ${s.note}` : ''}</li>
                  ))}
                </ul>
              </section>
            )}
            {mod.bookRefs.length === 0 && mod.videos.length === 0 && mod.sources.length === 0 && (
              <EmptyState>No sources listed for this module yet.</EmptyState>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          {mod.prereqs.length > 0 && (
            <span className="text-xs text-slate-400">Builds on: {mod.prereqs.length} module(s)</span>
          )}
          <button className={done ? 'btn-ghost' : 'btn-primary'} onClick={onToggleDone}>
            {done ? 'Mark incomplete' : 'Mark complete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
