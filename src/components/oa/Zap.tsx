import { useEffect, useRef, useState } from 'react';
import { zapRound, type ZapRound } from '../../engine/oaGames';
import { Card } from '../ui';

const ROUND_MS = 90 * 1000;

/**
 * Optiver-style grid: find a value in a field of numbers, against a clock.
 * Tests visual search and arithmetic comparison under pressure rather than
 * anything you can revise for — which is precisely why the screens use it.
 */
export function Zap({ best, onDone }: { best: number | null; onDone: (correct: number, total: number, ms: number) => void }) {
  const [round, setRound] = useState<ZapRound | null>(null);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!round) return;
    const t = setInterval(() => {
      const left = ROUND_MS - (Date.now() - startedAt.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        setResult({ correct, total: attempts });
        setRound(null);
        onDone(correct, attempts, Date.now() - startedAt.current);
      }
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, correct, attempts]);

  const start = () => {
    setCorrect(0); setAttempts(0); setResult(null); setFlash(null);
    setRemaining(ROUND_MS);
    startedAt.current = Date.now();
    setRound(zapRound());
  };

  const clickCell = (i: number) => {
    if (!round) return;
    const ok = i === round.targetIndex;
    setAttempts((a) => a + 1);
    if (ok) setCorrect((c) => c + 1);
    setFlash(ok ? 'hit' : 'miss');
    setTimeout(() => setFlash(null), 120);
    setRound(zapRound());
  };

  if (result) {
    return (
      <Card className="text-center">
        <div className="label mb-1">Zap complete</div>
        <div className="text-3xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{result.total}</span></div>
        <p className="mt-1 text-sm text-slate-500">
          {result.total ? Math.round((result.correct / result.total) * 100) : 0}% accuracy ·{' '}
          {result.correct ? (90 / result.correct).toFixed(1) : '—'}s per hit
        </p>
        <button className="btn-primary mt-3" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!round) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Zap</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          90 seconds. Each grid asks for the largest, smallest, or closest number to a target.
          Answer as many as you can — accuracy counts as much as speed.
        </p>
        {best !== null && <p className="mt-2 text-xs text-slate-400">Personal best: {best} correct</p>}
        <button className="btn-primary mt-3" onClick={start}>Start</button>
      </Card>
    );
  }

  const secs = Math.ceil(remaining / 1000);
  return (
    <Card>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">{round.instruction}</span>
        <span className={`font-mono text-sm ${secs < 15 ? 'text-red-500' : ''}`}>{secs}s</span>
        <span>{correct}/{attempts}</span>
      </div>
      <div className={`mt-3 grid grid-cols-4 gap-2 transition-colors ${flash === 'hit' ? 'opacity-70' : ''}`}>
        {round.grid.map((v, i) => (
          <button
            key={i}
            onClick={() => clickCell(i)}
            className="rounded-lg border border-slate-200 py-4 font-mono text-lg font-semibold transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-indigo-500/10"
          >
            {v}
          </button>
        ))}
      </div>
      {flash === 'miss' && <p className="mt-2 text-center text-xs text-red-500">Miss</p>}
    </Card>
  );
}
