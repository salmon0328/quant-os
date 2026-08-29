import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState, ProgressBar } from '../components/ui';
import type { Flashcard, KnowledgeEntry } from '../models';
import { dueForReview, srsActionFor, SRS_INTERVALS } from '../engine/spacedRepetition';
import { today, daysBetween } from '../lib/date';
import { uid } from '../lib/id';
import { buildQueue, loadDeck, mergeDeck, type DeckFilter } from '../data/flashcards';

const empty: KnowledgeEntry = {
  id: '', concept: '', category: 'Finance', definition: '', intuition: '', formula: '', example: '', commonMistake: '', related: [], srsStage: 0, nextReview: today(),
};

const FILTERS: { key: DeckFilter; label: string }[] = [
  { key: 'all', label: 'Due + new' },
  { key: 'due', label: 'Due only' },
  { key: 'new', label: 'Unseen' },
  { key: 'high', label: 'High quality' },
];

export default function Knowledge() {
  const { state, patch, reviewKnowledge, reviewCard, setDeckSize, logDrill } = useApp();
  const [mode, setMode] = useState<'drill' | 'cards'>('drill');
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
          <h1 className="text-2xl font-bold">Knowledge</h1>
          <p className="text-sm text-slate-400">Drill the interview deck daily · keep concept cards on spaced repetition ({SRS_INTERVALS.join('/')} day intervals).</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setMode('drill')} className={`chip ${mode === 'drill' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Drill</button>
          <button onClick={() => setMode('cards')} className={`chip ${mode === 'cards' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Concepts</button>
        </div>
      </div>

      {mode === 'drill' ? (
        <Drill
          onReview={reviewCard}
          onDeckSize={setDeckSize}
          onLog={logDrill}
          progress={state.cardProgress}
          deckSize={state.deckSize}
        />
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

// --------------------------------------------------------------------- drill

function Drill({
  onReview, onDeckSize, onLog, progress, deckSize,
}: {
  onReview: (id: string, remembered: boolean) => void;
  onDeckSize: (n: number) => void;
  onLog: (correct: number, total: number) => void;
  progress: Record<string, import('../models').CardProgress>;
  deckSize: number;
}) {
  const [seeds, setSeeds] = useState<Flashcard[] | null>(null);
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [size, setSize] = useState(8);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Merged deck: bundled text + persisted progress.
  const cards = useMemo(() => (seeds ? mergeDeck(seeds.map(toSeed), progress) : []), [seeds, progress]);

  const ensureDeck = useCallback(async () => {
    if (seeds) return seeds;
    setLoading(true);
    const loaded = await loadDeck();
    setSeeds(loaded);
    onDeckSize(loaded.length);
    setLoading(false);
    return loaded;
  }, [seeds, onDeckSize]);

  const start = async () => {
    const loaded = await ensureDeck();
    const merged = mergeDeck(loaded.map(toSeed), progress);
    const next = buildQueue(merged, filter, size);
    setQueue(next);
    setI(0);
    setRevealed(false);
    setScore(null);
  };

  const answer = (remembered: boolean) => {
    const card = queue[i];
    if (!card) return;
    onReview(card.id, remembered);
    setScore((s) => ({ correct: (s?.correct ?? 0) + (remembered ? 1 : 0), total: (s?.total ?? 0) + 1 }));
    if (i + 1 >= queue.length) {
      onLog((score?.correct ?? 0) + (remembered ? 1 : 0), queue.length);
      setQueue([]);
      return;
    }
    setI(i + 1);
    setRevealed(false);
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
            <p className="mt-1 text-xs text-slate-500">
              Missed cards drop a stage and come back sooner. That is the point.
            </p>
          </Card>
        )}

        <Card>
          <SectionTitle>Today's set</SectionTitle>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`chip ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-500">Cards per set</label>
            <select className="input w-24" value={size} onChange={(e) => setSize(+e.target.value)}>
              {[5, 8, 12, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn-primary ml-auto" onClick={start}>Start drill</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Card {i + 1} of {queue.length}</span>
        <span>{score ? `${score.correct}/${score.total} so far` : 'no score yet'}</span>
      </div>
      <ProgressBar value={(i / queue.length) * 100} />

      <Card className="min-h-[220px]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip tone="career">{card.deck}</Chip>
          {card.quality === 'high' && <Chip tone="ai">clean answer</Chip>}
          <span className="text-[10px] text-slate-400">stage {card.srsStage}</span>
        </div>
        <div className="text-lg font-semibold leading-snug">{card.question}</div>

        {revealed ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {card.answer}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-400 dark:border-slate-700">
            Say the answer out loud first — recall is the exercise, reading isn't.
          </div>
        )}
      </Card>

      {revealed ? (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-red-500" onClick={() => answer(false)}>Missed it</button>
          <button className="btn-primary flex-1" onClick={() => answer(true)}>Got it</button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)}>Show answer</button>
      )}
    </div>
  );
}

function toSeed(c: Flashcard) {
  return { deck: c.deck, section: c.section, question: c.question, answer: c.answer, quality: c.quality };
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
