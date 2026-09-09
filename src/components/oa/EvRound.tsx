import { useEffect, useRef, useState } from 'react';
import { evQuestion, type EvQuestion } from '../../engine/oaGames';
import { Card, SectionTitle } from '../ui';

const ROUND_MS = 6 * 60 * 1000;
const COUNT = 20;

export type Breakdown = Record<string, { correct: number; total: number; ms: number }>;

/**
 * Expected value and probability under time pressure — the round SIG and
 * Jane Street screens actually run. Questions are generated with their answers
 * derived from the same numbers shown, so an answer key cannot be wrong.
 */
export function EvRound({
  best,
  onDone,
}: {
  best: number | null;
  onDone: (correct: number, total: number, ms: number, breakdown: Breakdown) => void;
}) {
  const [qs, setQs] = useState<EvQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [feedback, setFeedback] = useState<{ ok: boolean; working: string } | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number; ms: number } | null>(null);
  const startedAt = useRef(0);
  const stats = useRef<Breakdown>({});
  const questionStart = useRef(0);

  const running = qs.length > 0 && !result;

  const finish = (finalCorrect?: number, attempted?: number) => {
    const ms = Date.now() - startedAt.current;
    const c = finalCorrect ?? correct;
    const total = attempted ?? idx;
    setResult({ correct: c, total, ms });
    setQs([]);
    onDone(c, total, ms, stats.current);
  };

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const left = ROUND_MS - (Date.now() - startedAt.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const start = () => {
    setQs(Array.from({ length: COUNT }, evQuestion));
    setIdx(0); setTyped(''); setCorrect(0); setFeedback(null); setResult(null);
    setRemaining(ROUND_MS);
    stats.current = {};
    startedAt.current = Date.now();
    questionStart.current = Date.now();
  };

  const submit = () => {
    const q = qs[idx];
    if (!q) return;
    const given = Number(typed.replace(/[, ]/g, ''));
    const ok = Number.isFinite(given) && Math.abs(given - q.answer) <= Math.max(q.tolerance, 1e-9);

    const bucket = (stats.current[q.category] ??= { correct: 0, total: 0, ms: 0 });
    bucket.total += 1;
    bucket.ms += Date.now() - questionStart.current;
    if (ok) bucket.correct += 1;

    const nextCorrect = correct + (ok ? 1 : 0);
    setCorrect(nextCorrect);
    setFeedback({ ok, working: q.working });
    setTyped('');

    if (idx + 1 >= qs.length) {
      finish(nextCorrect, qs.length);
      return;
    }
    setIdx(idx + 1);
    questionStart.current = Date.now();
  };

  if (result) {
    return (
      <Card>
        <SectionTitle>Round complete</SectionTitle>
        <div className="text-3xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{result.total}</span></div>
        <p className="mt-1 text-sm text-slate-500">
          {Math.round(result.ms / 1000)}s · {result.total ? Math.round((result.ms / result.total / 1000) * 10) / 10 : 0}s per question
        </p>
        <div className="mt-3 space-y-1">
          {Object.entries(stats.current).map(([cat, s]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-32 capitalize text-slate-500">{cat}</span>
              <span className={s.correct / s.total >= 0.6 ? 'text-emerald-500' : 'text-amber-500'}>
                {s.correct}/{s.total}
              </span>
              <span className="text-slate-400">{Math.round(s.ms / s.total / 1000)}s avg</span>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-3" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!running) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Expected value round</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          {COUNT} probability and expected-value questions in 6 minutes: dice, coins, cards,
          conditional probability, counting, and the fair value of a game. Answers as decimals.
        </p>
        {best !== null && <p className="mt-2 text-xs text-slate-400">Personal best: {best}/{COUNT}</p>}
        <button className="btn-primary mt-3" onClick={start}>Start</button>
      </Card>
    );
  }

  const q = qs[idx];
  const secs = Math.ceil(remaining / 1000);
  return (
    <Card>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{idx + 1} / {qs.length}</span>
        <span className={`font-mono text-sm ${secs < 60 ? 'text-red-500' : 'text-slate-400'}`}>
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </span>
        <span>{correct} correct</span>
      </div>

      <div className="mt-3 text-base font-medium leading-snug">{q.text}</div>

      <input
        className="input mt-3 w-full font-mono"
        autoFocus
        value={typed}
        placeholder="Answer"
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />

      {feedback && (
        <div className={`mt-2 rounded p-2 text-xs ${feedback.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
          <span className="font-semibold">{feedback.ok ? 'Correct.' : 'Not quite.'}</span> {feedback.working}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button className="btn-primary flex-1" onClick={submit}>Submit</button>
        <button className="btn-ghost" onClick={() => finish()}>End round</button>
      </div>
    </Card>
  );
}
