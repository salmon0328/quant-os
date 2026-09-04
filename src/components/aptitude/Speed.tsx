import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '../../components/ui';
import type { AptitudeScore } from '../../models';

/** The hub supplies the drill kind, so games only report their numbers. */
type Done = (score: number, total: number, ms: number) => void;

function rint(a: number, b: number) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

// ---------------------------------------------------------------------------
// 80 in 8 - the Optiver screen
// ---------------------------------------------------------------------------

const BLITZ_TIME = 8 * 60 * 1000;

/** One arithmetic question roughly in the difficulty band of the 80-in-8 test. */
function blitzQuestion(): { text: string; answer: number } {
  const kind = rint(0, 5);
  if (kind === 0) {
    const a = rint(11, 99), b = rint(11, 99);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (kind === 1) {
    let a = rint(30, 199), b = rint(11, 99);
    if (a < b) [a, b] = [b, a];
    return { text: `${a} - ${b}`, answer: a - b };
  }
  if (kind === 2) {
    const a = rint(3, 19), b = rint(3, 19);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (kind === 3) {
    const b = rint(3, 15), ans = rint(4, 19);
    return { text: `${b * ans} ÷ ${b}`, answer: ans };
  }
  if (kind === 4) {
    const p = pick([5, 10, 20, 25, 50]), base = rint(2, 40) * (p === 5 ? 20 : 10);
    return { text: `${p}% of ${base}`, answer: (base * p) / 100 };
  }
  const a = rint(2, 9), b = rint(2, 9), c = rint(2, 9);
  return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
}

export function Blitz({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [running, setRunning] = useState(false);
  const [qs, setQs] = useState<{ text: string; answer: number }[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(BLITZ_TIME);
  const [result, setResult] = useState<{ correct: number; attempted: number; ms: number } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 200;
        if (next <= 0) {
          finish();
          return 0;
        }
        return next;
      });
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const finish = () => {
    setRunning(false);
    const ms = Date.now() - startedAt.current;
    setResult({ correct, attempted, ms });
    onDone(correct, attempted, Math.min(ms, BLITZ_TIME));
  };

  const begin = () => {
    setQs(Array.from({ length: 80 }, blitzQuestion));
    setIdx(0); setTyped(''); setCorrect(0); setAttempted(0); setResult(null);
    setRemaining(BLITZ_TIME);
    startedAt.current = Date.now();
    setRunning(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qs[idx];
    if (!q) return;
    const ok = Number(typed.trim()) === q.answer;
    setCorrect((c) => c + (ok ? 1 : 0));
    setAttempted((a) => a + 1);
    setTyped('');
    if (idx + 1 >= qs.length) {
      finish();
      return;
    }
    setIdx((i) => i + 1);
  };

  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  if (result) {
    const pct = Math.round((result.correct / Math.max(1, result.attempted)) * 100);
    return (
      <Card className="text-center">
        <div className="label mb-2">Set complete</div>
        <div className="text-4xl font-bold text-slate-800 dark:text-slate-100">
          {result.correct}<span className="text-lg text-slate-400">/{result.attempted}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {pct}% accuracy in {mmss(result.ms)} · {80 - result.attempted} unanswered
        </p>
        {best && (
          <p className="mt-2 text-xs text-slate-400">
            Personal best: {best.score}/{best.total} in {mmss(best.ms)}
          </p>
        )}
        <button className="btn-primary mt-4" onClick={begin}>Run it again</button>
      </Card>
    );
  }

  if (!running) {
    return (
      <Card className="text-center">
        <div className="label mb-2">80 in 8</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          80 arithmetic questions, 8 minutes, no calculator. This is the screen that filters trading
          applicants — the point is automatic recall, so run it daily.
        </p>
        {best && (
          <p className="mt-2 text-xs text-slate-400">
            Personal best: {best.score}/{best.total} in {mmss(best.ms)}
          </p>
        )}
        <button className="btn-primary mt-4" onClick={begin}>Start 8-minute blitz</button>
      </Card>
    );
  }

  const q = qs[idx];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">Q{idx + 1} / 80</span>
        <span className={`font-mono text-lg font-bold ${remaining < 60000 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
          {mmss(remaining)}
        </span>
        <span className="text-sm text-emerald-600">{correct} ✓</span>
      </div>
      <form onSubmit={submit} className="flex items-center gap-3">
        <div className="flex-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{q.text} =</div>
        <input
          className="input w-32 text-right text-xl"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^0-9.-]/g, ''))}
          inputMode="numeric"
          autoFocus
          placeholder="?"
        />
      </form>
      <p className="mt-3 text-xs text-slate-400">Press Enter to submit — unanswered questions count as missed.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sequence trainer
// ---------------------------------------------------------------------------

type PatternQ = { seq: number[]; answer: number; hint: string };

function patternQuestion(): PatternQ {
  const kind = rint(0, 5);
  if (kind === 0) {
    const a = rint(2, 9), d = rint(2, 12), n = rint(4, 5);
    const seq = Array.from({ length: n }, (_, i) => a + i * d);
    return { seq, answer: a + n * d, hint: 'constant step' };
  }
  if (kind === 1) {
    const a = rint(2, 5), r = pick([2, 3]), n = 4;
    const seq = Array.from({ length: n }, (_, i) => a * Math.pow(r, i));
    return { seq, answer: a * Math.pow(r, n), hint: 'multiply each term' };
  }
  if (kind === 2) {
    const a = rint(1, 6), n = 5;
    const seq = Array.from({ length: n }, (_, i) => (a + i) * (a + i));
    return { seq, answer: (a + n) * (a + n), hint: 'squares' };
  }
  if (kind === 3) {
    const a = rint(1, 5), b = rint(3, 9);
    const seq = [a, b, a + b, a + 2 * b, 2 * a + 3 * b, 3 * a + 5 * b];
    return { seq, answer: 5 * a + 8 * b, hint: 'each term is the sum of the previous two' };
  }
  if (kind === 4) {
    // Two interleaved sequences.
    const a = rint(2, 9), da = rint(2, 7), b = rint(20, 60), db = rint(2, 9);
    const seq = [a, b, a + da, b + db, a + 2 * da, b + 2 * db, a + 3 * da];
    return { seq, answer: b + 3 * db, hint: 'two sequences interleaved' };
  }
  const a = rint(2, 12), n = 5;
  const seq = Array.from({ length: n }, (_, i) => a + i * (i + 1));
  return { seq, answer: a + n * (n + 1), hint: 'the step itself increases' };
}

export function Patterns({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TOTAL = 12;
  const [qs, setQs] = useState<PatternQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState<{ correct: number; ms: number } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const startedAt = useRef(0);

  const begin = () => {
    setQs(Array.from({ length: TOTAL }, patternQuestion));
    setIdx(0); setTyped(''); setCorrect(0); setDone(null); setFeedback(null);
    startedAt.current = Date.now();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qs[idx];
    if (!q) return;
    const ok = Number(typed.trim()) === q.answer;
    setCorrect((c) => c + (ok ? 1 : 0));
    setFeedback(ok ? 'Correct' : `It was ${q.answer} — ${q.hint}`);
    setTyped('');
    setTimeout(() => {
      setFeedback(null);
      if (idx + 1 >= qs.length) {
        const ms = Date.now() - startedAt.current;
        const finalCorrect = correct + (ok ? 1 : 0);
        setDone({ correct: finalCorrect, ms });
        onDone(finalCorrect, TOTAL, ms);
        return;
      }
      setIdx((i) => i + 1);
    }, ok ? 450 : 1400);
  };

  if (done) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Series complete</div>
        <div className="text-4xl font-bold text-slate-800 dark:text-slate-100">{done.correct}<span className="text-lg text-slate-400">/{TOTAL}</span></div>
        <p className="mt-1 text-sm text-slate-500">in {(done.ms / 1000).toFixed(0)}s</p>
        <button className="btn-primary mt-4" onClick={begin}>Another 12</button>
      </Card>
    );
  }

  if (!qs.length) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Number series</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          Find the rule and type the next term. Covers constant step, geometric, squares, Fibonacci,
          interleaved and increasing-step series.
        </p>
        {best && <p className="mt-2 text-xs text-slate-400">Best: {best.score}/{best.total}</p>}
        <button className="btn-primary mt-4" onClick={begin}>Start series</button>
      </Card>
    );
  }

  const q = qs[idx];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>Series {idx + 1} / {TOTAL}</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
        {q.seq.map((n, i) => (
          <span key={i}>{n}{i === q.seq.length - 1 ? '' : ','}</span>
        ))}
        <span className="text-slate-400">, ?</span>
      </div>
      <form onSubmit={submit} className="mt-4 flex items-center gap-3">
        <input
          className="input w-32 text-right text-xl"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^0-9-]/g, ''))}
          inputMode="numeric"
          autoFocus
          placeholder="?"
        />
        <button className="btn-primary" type="submit">Submit</button>
      </form>
      {feedback && <p className={`mt-3 text-sm ${feedback === 'Correct' ? 'text-emerald-600' : 'text-amber-600'}`}>{feedback}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reaction time
// ---------------------------------------------------------------------------

export function Reaction({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TRIALS = 5;
  const [phase, setPhase] = useState<'idle' | 'wait' | 'go' | 'result'>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [msg, setMsg] = useState('Click to begin');
  const shownAt = useRef(0);
  const timer = useRef<number | null>(null);

  const schedule = useCallback(() => {
    setPhase('wait');
    setMsg('Wait for green…');
    const delay = 900 + Math.random() * 2600;
    timer.current = window.setTimeout(() => {
      shownAt.current = performance.now();
      setPhase('go');
      setMsg('CLICK');
    }, delay);
  }, []);

  const onClick = () => {
    if (phase === 'idle') {
      setTimes([]);
      schedule();
      return;
    }
    if (phase === 'wait') {
      if (timer.current) window.clearTimeout(timer.current);
      setPhase('idle');
      setMsg('Too early — click to try again');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - shownAt.current);
      const next = [...times, ms];
      setTimes(next);
      if (next.length >= TRIALS) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        setPhase('result');
        setMsg(`Average ${avg} ms`);
        onDone(0, TRIALS, avg);
        return;
      }
      schedule();
    }
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const bg =
    phase === 'go' ? 'bg-emerald-500' : phase === 'wait' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800';

  return (
    <Card className="text-center">
      <div className="label mb-2">Reaction time</div>
      <button
        onClick={onClick}
        className={`mx-auto flex h-40 w-full max-w-md items-center justify-center rounded-xl text-xl font-bold text-white transition-colors ${bg}`}
      >
        {msg}
      </button>
      <div className="mt-3 text-sm text-slate-500">
        {times.length > 0 && `Trials: ${times.join(', ')} ms`}
      </div>
      {phase === 'result' && (
        <div className="mt-3">
          <p className="text-sm text-slate-500">
            Sub-250ms is competitive for trading screens. Best is the lowest average.
          </p>
          {best && <p className="mt-1 text-xs text-slate-400">Best average: {best.ms} ms</p>}
          <button className="btn-primary mt-3" onClick={() => { setPhase('idle'); setTimes([]); setMsg('Click to begin'); }}>
            Run again
          </button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Wordle
// ---------------------------------------------------------------------------

const WORDS = [
  'PRICE', 'DEALT', 'SWAPS', 'ASSET', 'YIELD', 'OPTION', 'DELTA',
  'RISKS', 'FUNDS', 'TREND', 'BONDS', 'RATES', 'LIMIT', 'ORDER',
  'TRACK', 'SHIFT', 'VALUE', 'GROSS', 'SMART', 'BLOCK', 'GRAIN', 'SHARP',
  'PLAIN', 'ROUND', 'STAGE', 'TRUST', 'CLEAR', 'QUICK', 'BRAVE', 'FLAME',
  'GLASS', 'HEART', 'LIGHT', 'MONEY', 'NIGHT', 'PEARL', 'RIVER', 'SOUND',
  'TABLE', 'WATER', 'WHEEL', 'WORLD', 'YOUNG', 'ALERT', 'BLEND', 'CHASE',
].filter((w) => w.length === 5);

type Mark = 'absent' | 'present' | 'correct';

function markGuess(guess: string, target: string): Mark[] {
  const out: Mark[] = Array(5).fill('absent');
  const pool: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) out[i] = 'correct';
    else pool[target[i]] = (pool[target[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === 'correct') continue;
    const ch = guess[i];
    if ((pool[ch] ?? 0) > 0) {
      out[i] = 'present';
      pool[ch] -= 1;
    }
  }
  return out;
}

export function Wordle({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [target, setTarget] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const startedAt = useRef(0);

  const begin = () => {
    setTarget(pick(WORDS));
    setGuesses([]); setTyped(''); setStatus('playing');
    startedAt.current = Date.now();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = typed.trim().toUpperCase();
    if (g.length !== 5) return;
    const next = [...guesses, g];
    setGuesses(next);
    setTyped('');
    if (g === target) {
      setStatus('won');
      onDone(1, next.length, Date.now() - startedAt.current);
    } else if (next.length >= 6) {
      setStatus('lost');
      onDone(0, 6, Date.now() - startedAt.current);
    }
  };

  if (!target) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Wordle</div>
        <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
          Six guesses at a five-letter word. Green = right letter, right place; amber = right letter,
          wrong place. It is quiet practice for the pattern-elimination habit.
        </p>
        {best && <p className="mt-2 text-xs text-slate-400">Best: solved in {best.total}</p>}
        <button className="btn-primary mt-4" onClick={begin}>New word</button>
      </Card>
    );
  }

  const rows = [...guesses, ...Array(Math.max(0, 6 - guesses.length)).fill('')].slice(0, 6);

  return (
    <Card>
      <div className="space-y-1.5">
        {rows.map((g, ri) => {
          const marks = g ? markGuess(g, target) : [];
          return (
            <div key={ri} className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }).map((_, ci) => {
                const ch = g[ci] ?? '';
                const m = marks[ci];
                const bg =
                  m === 'correct' ? 'bg-emerald-500 text-white'
                    : m === 'present' ? 'bg-amber-400 text-white'
                      : ch ? 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        : 'bg-slate-100 dark:bg-slate-800';
                return (
                  <div key={ci} className={`flex h-12 items-center justify-center rounded text-lg font-bold uppercase ${bg}`}>
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {status === 'playing' ? (
        <form onSubmit={submit} className="mt-4 flex items-center gap-2">
          <input
            className="input w-40 text-center text-lg uppercase tracking-widest"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5))}
            maxLength={5}
            autoFocus
            placeholder="guess"
          />
          <button className="btn-primary" type="submit" disabled={typed.length !== 5}>Guess</button>
        </form>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {status === 'won' ? `Solved in ${guesses.length}` : `It was ${target}`}
          </p>
          <button className="btn-primary mt-3" onClick={begin}>New word</button>
        </div>
      )}
    </Card>
  );
}
