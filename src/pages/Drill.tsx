import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState, ProgressBar } from '../components/ui';
import type { CardRole, Flashcard, KnowledgeEntry, RecallGrade } from '../models';
import { aiAvailable, gradeAnswer, followUp, AiError, type GradeResult, type FollowUpResult } from '../lib/ai';
import { dueForReview, srsActionFor, intervalPreview, gradeFromScore } from '../engine/spacedRepetition';
import { today, daysBetween } from '../lib/date';
import { uid } from '../lib/id';
import { buildQueue, loadDeck, loadSeeds, mergeDeck, topicsOf, positionIn, type DeckFilter, type TopicGroup } from '../data/flashcards';

const empty: KnowledgeEntry = {
  id: '', concept: '', category: 'Finance', definition: '', intuition: '', formula: '', example: '', commonMistake: '', related: [], srsStage: 0, nextReview: today(),
};

const ROLES: { key: CardRole | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'quant', label: 'Quant' },
  { key: 'markets', label: 'Markets' },
  { key: 'ib', label: 'Banking' },
];

const FILTERS: { key: DeckFilter; label: string }[] = [
  { key: 'all', label: 'Due + new' },
  { key: 'due', label: 'Due only' },
  { key: 'new', label: 'Unseen' },
  { key: 'high', label: 'High quality' },
];

export default function Drill() {
  const { state, patch, reviewKnowledge, reviewCard, adoptDeck, logDrill } = useApp();
  const [mode, setMode] = useState<'drill' | 'mock' | 'cards' | 'quiz'>('drill');
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
          <h1 className="text-2xl font-bold">Interview Drill</h1>
          <p className="text-sm text-slate-400">Questions pulled from your interview books, on spaced repetition. Type an answer to have it marked, then let the interviewer push back.</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setMode('drill')} className={`chip ${mode === 'drill' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Drill</button>
          <button onClick={() => setMode('mock')} className={`chip ${mode === 'mock' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Mock</button>
          <button onClick={() => setMode('cards')} className={`chip ${mode === 'cards' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Concepts</button>
          <button onClick={() => setMode('quiz')} className={`chip ${mode === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Quiz</button>
        </div>
      </div>

      {mode === 'drill' ? (
        <DrillRunner
          onReview={reviewCard}
          onDeckSize={adoptDeck}
          onLog={logDrill}
          progress={state.cardProgress}
          deckSize={state.deckSize}
        />
      ) : mode === 'mock' ? (
        <Mock onLog={logDrill} />
      ) : mode === 'quiz' ? (
        <Quiz knowledge={state.knowledge} onReview={reviewKnowledge} />
      ) : (
        <>
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <input className="input w-full sm:w-72" placeholder="Search concepts…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-primary" onClick={() => setEditing({ ...empty })}>+ New concept</button>
          </div>

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
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------- type-answer quiz

function Quiz({
  knowledge, onReview,
}: {
  knowledge: KnowledgeEntry[];
  onReview: (id: string, remembered: boolean) => void;
}) {
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const [queue, setQueue] = useState<KnowledgeEntry[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);

  const start = () => {
    const pool = scope === 'due' ? knowledge.filter((e) => (e.nextReview ?? '') <= today()) : [...knowledge];
    const ordered = pool.sort((a, b) => a.srsStage - b.srsStage || a.concept.localeCompare(b.concept));
    setQueue(ordered);
    setI(0);
    setTyped('');
    setRevealed(false);
  };

  const advance = (remembered: boolean) => {
    const e = queue[i];
    if (e) onReview(e.id, remembered);
    if (i + 1 >= queue.length) {
      setQueue([]);
      return;
    }
    setI(i + 1);
    setTyped('');
    setRevealed(false);
  };

  if (queue.length === 0) {
    const dueCount = knowledge.filter((e) => (e.nextReview ?? '') <= today()).length;
    return (
      <Card>
        <SectionTitle>Active recall — type the answer</SectionTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Recall from memory, type it out, then reveal the model answer and grade yourself.
          {scope === 'due' ? ` ${dueCount} concept(s) due for review.` : ` ${knowledge.length} concept(s) in the deck.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            <button onClick={() => setScope('due')} className={`chip ${scope === 'due' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Due only</button>
            <button onClick={() => setScope('all')} className={`chip ${scope === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All</button>
          </div>
          <button className="btn-primary ml-auto" onClick={start} disabled={knowledge.length === 0}>Start quiz</button>
        </div>
      </Card>
    );
  }

  const e = queue[i];
  const hint = typed.trim().length > 0 && e.definition.toLowerCase().includes(typed.trim().toLowerCase().slice(0, 10));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Concept {i + 1} of {queue.length}</span>
        <Chip>{e.category}</Chip>
      </div>
      <Card className="min-h-[200px]">
        <div className="label">Define</div>
        <div className="text-lg font-semibold leading-snug">{e.concept}</div>
        <textarea
          className="input mt-3 w-full"
          rows={4}
          placeholder="Type your answer from memory…"
          value={typed}
          onChange={(ev) => setTyped(ev.target.value)}
        />
        {revealed ? (
          <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {e.definition && <div><span className="font-semibold">Definition:</span> {e.definition}</div>}
            {e.intuition && <div><span className="font-semibold">Intuition:</span> {e.intuition}</div>}
            {e.formula && <div className="font-mono text-xs"><span className="font-semibold">Formula:</span> {e.formula}</div>}
            {e.example && <div><span className="font-semibold">Example:</span> {e.example}</div>}
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-400">
            {hint ? 'On the right track — reveal to compare.' : 'Reveal the model answer when ready to self-grade.'}
          </div>
        )}
      </Card>
      {revealed ? (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-red-500" onClick={() => advance(false)}>Forgot</button>
          <button className="btn-primary flex-1" onClick={() => advance(true)}>Remembered</button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)}>Reveal answer</button>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- drill

function DrillRunner({
  onReview, onDeckSize, onLog, progress, deckSize,
}: {
  onReview: (id: string, grade: RecallGrade) => void;
  onDeckSize: (seeds: import('../models').FlashcardSeed[]) => void;
  onLog: (correct: number, total: number) => void;
  progress: Record<string, import('../models').CardProgress>;
  deckSize: number;
}) {
  const [seeds, setSeeds] = useState<Flashcard[] | null>(null);
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [size, setSize] = useState(8);
  const [shuffle, setShuffle] = useState(false);
  const [topic, setTopic] = useState('');
  const [role, setRole] = useState<CardRole | ''>('');
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  // --- typed answers, AI grading and follow-ups (all optional) ---
  const [typed, setTyped] = useState('');
  const [graded, setGraded] = useState<GradeResult | null>(null);
  const [probe, setProbe] = useState<FollowUpResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [missed, setMissed] = useState<Flashcard[]>([]);

  useEffect(() => { void aiAvailable().then(setAiOn); }, []);

  // Merged deck: bundled text + persisted progress.
  const cards = useMemo(() => (seeds ? mergeDeck(seeds.map(toSeed), progress) : []), [seeds, progress]);

  const ensureDeck = useCallback(async () => {
    if (seeds) return seeds;
    setLoading(true);
    // The raw seeds carry legacyIds, which the merged Flashcard shape drops —
    // and those are exactly what the progress migration needs.
    const rawSeeds = await loadSeeds();
    const loaded = await loadDeck();
    setSeeds(loaded);
    onDeckSize(rawSeeds);
    setLoading(false);
    return loaded;
  }, [seeds, onDeckSize]);

  const start = async () => {
    const loaded = await ensureDeck();
    const merged = mergeDeck(loaded.map(toSeed), progress);
    const next = buildQueue(merged, filter, size, today(), shuffle ? 'shuffle' : 'sequential', topic || undefined, role || undefined);
    setQueue(next);
    setI(0);
    setRevealed(false);
    setScore(null);
    setMissed([]);
    setTyped('');
    setGraded(null);
    setProbe(null);
  };

  const answer = (grade: RecallGrade) => {
    const card = queue[i];
    if (!card) return;
    const ok = grade !== 'again';
    onReview(card.id, grade);
    setMissed((m) => (ok ? m : [...m, card]));
    setScore((s) => ({ correct: (s?.correct ?? 0) + (ok ? 1 : 0), total: (s?.total ?? 0) + 1 }));
    // Reset the per-card AI state so the next card starts clean.
    setTyped('');
    setGraded(null);
    setProbe(null);
    setAiError(null);
    if (i + 1 >= queue.length) {
      onLog((score?.correct ?? 0) + (ok ? 1 : 0), queue.length);
      setQueue([]);
      return;
    }
    setI(i + 1);
    setRevealed(false);
  };

  /**
   * Send the typed answer for grading. The whole point of typing it is that
   * self-grading is generous — you recognise the answer and call it recall.
   */
  const submitForGrading = async () => {
    const card = queue[i];
    if (!card || !typed.trim()) return;
    setBusy(true);
    setAiError(null);
    try {
      const result = await gradeAnswer({
        question: card.question,
        modelAnswer: card.answer,
        userAnswer: typed,
        topic: card.section,
      });
      setGraded(result);
      setRevealed(true);
    } catch (e) {
      setAiError(e instanceof AiError ? e.message : 'Grading failed.');
      setRevealed(true);
    } finally {
      setBusy(false);
    }
  };

  /** One probing question, the way a real interviewer pushes after a good answer. */
  const askFollowUp = async () => {
    const card = queue[i];
    if (!card) return;
    setBusy(true);
    setAiError(null);
    try {
      setProbe(await followUp({
        question: card.question,
        modelAnswer: card.answer,
        userAnswer: typed || undefined,
        topic: card.section,
      }));
    } catch (e) {
      setAiError(e instanceof AiError ? e.message : 'Could not fetch a follow-up.');
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const seen = Object.values(progress);
    const correct = seen.reduce((a, p) => a + p.timesCorrect, 0);
    const attempts = seen.reduce((a, p) => a + p.timesSeen, 0);
    const dueNow = cards.filter((c) => c.nextReview <= today()).length;
    return {
      total: deckSize || cards.length,
      started: seen.length,
      attempts,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      dueNow,
    };
  }, [progress, cards, deckSize]);

  const card = queue[i];

  // Topics in the order they appear in the source books.
  const topics = useMemo<TopicGroup[]>(
    () => topicsOf(role ? cards.filter((c) => c.role === role) : cards),
    [cards, role]
  );
  const groupedTopics = useMemo(() => {
    const map = new Map<string, TopicGroup[]>();
    for (const t of topics) {
      const rows = map.get(t.deck) ?? [];
      rows.push(t);
      map.set(t.deck, rows);
    }
    return [...map.entries()];
  }, [topics]);

  if (!seeds) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Interview drill</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          {deckSize > 0
            ? `${deckSize} questions were extracted from your interview books. Tap start to load the deck and drill today's set.`
            : 'Load the deck built from your interview books (Wall Street Prep + BIWS 400).'}
        </p>
        <button className="btn-primary mt-3" disabled={loading} onClick={start}>
          {loading ? 'Loading deck…' : 'Load deck & start'}
        </button>
      </Card>
    );
  }

  if (queue.length === 0) {
    const last = score;
    return (
      <div className="space-y-4">
        <Card>
          <SectionTitle>Deck ready — {stats.total} questions</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Started" value={stats.started} />
            <Stat label="Due now" value={stats.dueNow} color="#6366f1" />
            <Stat label="Attempts" value={stats.attempts} />
            <Stat label="Accuracy" value={`${stats.accuracy}%`} color={stats.accuracy >= 70 ? '#10b981' : '#f59e0b'} />
          </div>
          {stats.started > 0 && (
            <div className="mt-3">
              <ProgressBar value={stats.accuracy} color={stats.accuracy >= 70 ? '#10b981' : '#f59e0b'} />
            </div>
          )}
        </Card>

        {last && (
          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Set complete — {last.correct}/{last.total} recalled.
            </div>
            {/* Naming what you missed is the useful half of a review session;
                a bare score tells you nothing you can act on. */}
            {missed.length > 0 ? (
              <div className="mt-2">
                <div className="label text-amber-600">Come back to these</div>
                <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {missed.map((c) => (
                    <li key={c.id}>
                      <span className="text-slate-400">{c.section} — </span>{c.question}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Clean sweep. Intervals pushed out accordingly.</p>
            )}
          </Card>
        )}

        <Card>
          <SectionTitle>Today's set</SectionTitle>
          {/* Target role first: the extracted deck is mostly banking content,
              which is the wrong drill if you are aiming at quant. */}
          <div className="mb-2">
            <label className="mb-1 block text-xs text-slate-500">Target role</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => {
                const count = r.key ? cards.filter((c) => c.role === r.key).length : cards.length;
                const disabled = count === 0 && r.key !== '';
                return (
                  <button
                    key={r.key || 'all'}
                    disabled={disabled}
                    onClick={() => { setRole(r.key); setTopic(''); }}
                    title={disabled ? 'No cards tagged for this role yet — run scripts/clean_flashcards.py' : undefined}
                    className={`chip ${role === r.key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {r.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`chip ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {topics.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500">
                Topic — as ordered in the book (leave on “All” to walk the whole deck top-to-bottom)
              </label>
              <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">All topics ({stats.total} questions)</option>
                {groupedTopics.map(([book, rows]) => (
                  <optgroup key={book} label={book}>
                    {rows.map((t) => (
                      <option key={`${t.deck}::${t.section}`} value={t.section}>
                        {t.section} ({t.count})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-500">Cards per set</label>
            <select className="input w-24" value={size} onChange={(e) => setSize(+e.target.value)}>
              {[5, 8, 12, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Off = walk the deck top-to-bottom (intro → advanced). On = randomise.">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              Shuffle
            </label>
            <button className="btn-primary ml-auto" onClick={start}>Start drill</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {(() => {
            const pos = positionIn(cards, card.id);
            return (
              <>
                {card.deck} › {pos.topic} › {pos.index}/{pos.total}
                <span className="ml-2 text-slate-500">set {i + 1}/{queue.length}</span>
              </>
            );
          })()}
        </span>
        <span>{score ? `${score.correct}/${score.total} so far` : 'no score yet'}</span>
      </div>
      <ProgressBar value={(i / queue.length) * 100} />

      <Card className="min-h-[220px]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip tone="career">{card.section}</Chip>
          {card.confidence === 'low' && (
            <span title="The parser could not recover a complete answer for this one — check the book before trusting it.">
              <Chip tone="finance">check in book</Chip>
            </span>
          )}
          {card.page ? <span className="text-[10px] text-slate-400">p.{card.page}</span> : null}
          <span className="text-[10px] text-slate-400">stage {card.srsStage}</span>
        </div>
        <div className="text-lg font-semibold leading-snug">{card.question}</div>

        {!revealed && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-400 dark:border-slate-700">
            Say the answer out loud first — recall is the exercise, reading isn't.
          </div>
        )}

        {/* Typing the answer is what makes grading honest: recognising a model
            answer feels like recall and isn't. Only offered when AI is up. */}
        {aiOn && !revealed && (
          <div className="mt-3">
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Optional: type your answer and have it marked against the model answer…"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button
              className="btn-ghost mt-2"
              disabled={busy || !typed.trim()}
              onClick={() => void submitForGrading()}
            >
              {busy ? 'Marking…' : 'Mark my answer'}
            </button>
          </div>
        )}

        {revealed && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {card.answer}
          </div>
        )}

        {graded && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div className="font-semibold text-indigo-700 dark:text-indigo-300">
              {graded.score}/3 — {graded.verdict}
            </div>
            {graded.wrong?.length > 0 && (
              <div className="mt-2">
                <span className="label text-red-500">Wrong</span>
                <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300">
                  {graded.wrong.map((w, k) => <li key={k}>{w}</li>)}
                </ul>
              </div>
            )}
            {graded.missed?.length > 0 && (
              <div className="mt-2">
                <span className="label text-amber-500">Missed</span>
                <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300">
                  {graded.missed.map((m, k) => <li key={k}>{m}</li>)}
                </ul>
              </div>
            )}
            {graded.nitpick && <p className="mt-2 text-xs italic text-slate-500">{graded.nitpick}</p>}
            <p className="mt-2 text-xs text-slate-500">
              That scores as <b>{GRADES.find((g) => g.key === gradeFromScore(graded.score))?.label}</b> — but the
              final call is yours.
            </p>
          </div>
        )}

        {probe && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="label text-amber-600">Follow-up · {probe.why}</div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{probe.question}</div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">What they're listening for</summary>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{probe.answer}</p>
            </details>
          </div>
        )}

        {aiError && <p className="mt-3 text-xs text-amber-600">{aiError} Grade it yourself below.</p>}
      </Card>

      {revealed ? (
        <div className="space-y-2">
          {/* Four grades, not two: "got it eventually" and "instant" should not
              earn the same interval, and that gap is most of what SRS is for. */}
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g.key}
                className={`btn-ghost flex flex-col items-center py-2 ${g.tone}`}
                onClick={() => answer(g.key)}
                title={g.hint}
              >
                <span className="text-sm font-semibold">{g.label}</span>
                <span className="text-[10px] opacity-70">{intervalPreview(progress[card.id], g.key)}</span>
              </button>
            ))}
          </div>
          {aiOn && !probe && (
            <button className="btn-ghost w-full text-xs" disabled={busy} onClick={() => void askFollowUp()}>
              {busy ? 'Thinking…' : 'Push me — ask a follow-up'}
            </button>
          )}
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)}>Show answer</button>
      )}
    </div>
  );
}

/** Grade buttons. `again` is a lapse; the rest all count as recalled. */
const GRADES: { key: RecallGrade; label: string; hint: string; tone: string }[] = [
  { key: 'again', label: 'Again', hint: 'Could not recall it — comes back almost immediately.', tone: 'text-red-500' },
  { key: 'hard', label: 'Hard', hint: 'Got there, but it was a struggle.', tone: 'text-amber-500' },
  { key: 'good', label: 'Good', hint: 'Recalled it correctly.', tone: 'text-emerald-500' },
  { key: 'easy', label: 'Easy', hint: 'Instant — push this one far out.', tone: 'text-indigo-500' },
];

function toSeed(c: Flashcard) {
  // page + confidence must survive the round-trip, otherwise the deck loses the
  // provenance that lets you check a card against the book.
  return {
    deck: c.deck, section: c.section, question: c.question, answer: c.answer,
    quality: c.quality, page: c.page, confidence: c.confidence,
  };
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{ color }}>{value}</div>
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

// ---------------------------------------------------------------------------
// Mock interview
//
// The drill is recall practice: one card, reveal, grade. A real technical round
// is not that. It is timed, you have to speak the whole answer before anyone
// tells you if you were right, and every answer gets pushed on. This runs that
// shape: a fixed set from one role, no reveals until the end, follow-ups on,
// then one scorecard naming what you actually missed.
// ---------------------------------------------------------------------------

const MOCK_MINUTES = 20;
const MOCK_QUESTIONS = 6;

interface MockTurn {
  card: Flashcard;
  answer: string;
  grade?: GradeResult;
  probe?: FollowUpResult;
  probeAnswer?: string;
}

function Mock({ onLog }: { onLog: (correct: number, total: number) => void }) {
  const [role, setRole] = useState<CardRole>('quant');
  const [turns, setTurns] = useState<MockTurn[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [probeTyped, setProbeTyped] = useState('');
  const [stage, setStage] = useState<'setup' | 'running' | 'marking' | 'done'>('setup');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [aiOn, setAiOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<{ role: CardRole; n: number }[]>([]);

  useEffect(() => { void aiAvailable().then(setAiOn); }, []);

  // A visible clock is most of what makes a mock feel different from a drill.
  useEffect(() => {
    if (stage !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => {
    void loadDeck().then((deck) => {
      setAvailable((['quant', 'markets', 'ib'] as CardRole[]).map((r) => ({
        role: r,
        n: deck.filter((c) => c.role === r).length,
      })));
    });
  }, []);

  const begin = async () => {
    const deck = await loadDeck();
    const pool = deck.filter((c) => c.role === role);
    if (pool.length === 0) return;
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, MOCK_QUESTIONS);
    setTurns(picked.map((card) => ({ card, answer: '' })));
    setI(0);
    setTyped('');
    setProbeTyped('');
    setStartedAt(Date.now());
    setNow(Date.now());
    setStage('running');
    setError(null);
  };

  const current = turns[i];
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const remaining = MOCK_MINUTES * 60 - elapsed;

  /** Ask the follow-up mid-interview, without revealing whether the answer was right. */
  const pushBack = async () => {
    if (!current || !aiOn) return;
    try {
      const probe = await followUp({
        question: current.card.question,
        modelAnswer: current.card.answer,
        userAnswer: typed,
        topic: current.card.section,
      });
      setTurns((t) => t.map((x, k) => (k === i ? { ...x, answer: typed, probe } : x)));
    } catch {
      // A failed follow-up must not derail the interview — just move on.
      setTurns((t) => t.map((x, k) => (k === i ? { ...x, answer: typed } : x)));
      next();
    }
  };

  const next = () => {
    setTurns((t) => t.map((x, k) => (k === i ? {
      ...x,
      answer: x.answer || typed,
      probeAnswer: probeTyped || undefined,
    } : x)));
    setTyped('');
    setProbeTyped('');
    if (i + 1 >= turns.length) void finish();
    else setI(i + 1);
  };

  /** All marking happens at the end — that is what makes it an interview. */
  const finish = async () => {
    setStage('marking');
    const finished = turns.map((x, k) => (k === i
      ? { ...x, answer: x.answer || typed, probeAnswer: probeTyped || undefined }
      : x));

    if (!aiOn) {
      setTurns(finished);
      setStage('done');
      return;
    }

    try {
      const graded = await Promise.all(finished.map(async (turn) => {
        if (!turn.answer.trim()) return turn;
        try {
          return {
            ...turn,
            grade: await gradeAnswer({
              question: turn.card.question,
              modelAnswer: turn.card.answer,
              userAnswer: turn.answer,
              topic: turn.card.section,
            }),
          };
        } catch {
          return turn;
        }
      }));
      setTurns(graded);
      onLog(graded.filter((t) => (t.grade?.score ?? 0) >= 2).length, graded.length);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Marking failed — your answers are below.');
      setTurns(finished);
    }
    setStage('done');
  };

  // ------------------------------------------------------------------ setup
  if (stage === 'setup') {
    const count = available.find((a) => a.role === role)?.n ?? 0;
    return (
      <Card>
        <SectionTitle>Mock interview</SectionTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {MOCK_QUESTIONS} questions, {MOCK_MINUTES} minutes, no answers shown until the end.
          Type your answer as you would say it out loud. You get pushed on each one, and a
          scorecard at the finish.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {available.map((a) => (
            <button
              key={a.role}
              disabled={a.n === 0}
              onClick={() => setRole(a.role)}
              className={`chip ${role === a.role ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'} ${a.n === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {a.role} ({a.n})
            </button>
          ))}
        </div>
        {!aiOn && (
          <p className="mt-3 text-xs text-amber-600">
            AI is off, so answers will not be marked — you will still get the questions under
            the clock, with the model answers at the end.
          </p>
        )}
        <button className="btn-primary mt-3" disabled={count === 0} onClick={() => void begin()}>
          {count === 0 ? 'No cards tagged for this role yet' : 'Start the interview'}
        </button>
      </Card>
    );
  }

  // ---------------------------------------------------------------- marking
  if (stage === 'marking') {
    return <Card className="text-center"><div className="py-6 text-sm text-slate-500">Marking your answers…</div></Card>;
  }

  // ------------------------------------------------------------------- done
  if (stage === 'done') {
    const marked = turns.filter((t) => t.grade);
    const avg = marked.length
      ? marked.reduce((a, t) => a + (t.grade?.score ?? 0), 0) / marked.length
      : null;
    return (
      <div className="space-y-4">
        <Card>
          <SectionTitle>Scorecard</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Questions" value={turns.length} />
            <Stat label="Time" value={`${Math.floor(elapsed / 60)}m ${elapsed % 60}s`} />
            <Stat
              label="Average"
              value={avg === null ? '—' : `${avg.toFixed(1)}/3`}
              color={avg === null ? undefined : avg >= 2 ? '#10b981' : '#f59e0b'}
            />
          </div>
          {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}
          <button className="btn-ghost mt-3" onClick={() => setStage('setup')}>Run another</button>
        </Card>

        {turns.map((t, k) => (
          <Card key={t.card.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="career">{t.card.section}</Chip>
              {t.grade && (
                <span className={`text-xs font-bold ${t.grade.score >= 2 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {t.grade.score}/3
                </span>
              )}
              <span className="text-[10px] text-slate-400">Q{k + 1}</span>
            </div>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">{t.card.question}</div>

            <div className="mt-2 rounded bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
              <span className="label">You said</span>
              <p className="text-slate-600 dark:text-slate-300">{t.answer || <i>no answer given</i>}</p>
            </div>

            {t.grade && (
              <div className="mt-2 text-xs">
                <p className="text-slate-600 dark:text-slate-300">{t.grade.verdict}</p>
                {t.grade.wrong?.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-red-500">
                    {t.grade.wrong.map((w, j) => <li key={j}>{w}</li>)}
                  </ul>
                )}
                {t.grade.missed?.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-amber-600">
                    {t.grade.missed.map((mm, j) => <li key={j}>{mm}</li>)}
                  </ul>
                )}
              </div>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-indigo-500">Model answer</summary>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t.card.answer}</p>
            </details>
          </Card>
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------- running
  const overtime = remaining <= 0;
  return (
    <div className="space-y-3">
      <Card className={overtime ? 'border-red-300 dark:border-red-500/40' : undefined}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Question {i + 1} of {turns.length}</span>
          <span className={`font-mono text-sm ${overtime ? 'text-red-500' : remaining < 180 ? 'text-amber-500' : 'text-slate-400'}`}>
            {overtime ? '+' : ''}{Math.floor(Math.abs(remaining) / 60)}:{String(Math.abs(remaining) % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="mt-2 text-lg font-semibold leading-snug">{current?.card.question}</div>

        <textarea
          className="input mt-3 w-full"
          rows={5}
          placeholder="Answer as you would say it out loud…"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />

        {current?.probe && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="label text-amber-600">Follow-up</div>
            <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{current.probe.question}</div>
            <textarea
              className="input mt-2 w-full"
              rows={3}
              placeholder="And your answer to that…"
              value={probeTyped}
              onChange={(e) => setProbeTyped(e.target.value)}
            />
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        {aiOn && !current?.probe && (
          <button className="btn-ghost flex-1" disabled={!typed.trim()} onClick={() => void pushBack()}>
            Submit &amp; take the follow-up
          </button>
        )}
        <button className="btn-primary flex-1" onClick={next}>
          {i + 1 >= turns.length ? 'Finish & mark' : 'Next question'}
        </button>
      </div>
      <p className="text-center text-xs text-slate-400">
        No answers until the end — that is the point.
      </p>
    </div>
  );
}
