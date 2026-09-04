import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../components/ui';
import type { AptitudeScore } from '../../models';

type Done = (score: number, total: number, ms: number) => void;

function rint(a: number, b: number) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Shared shell: idle blurb -> running -> result, with a best-score line. */
function Shell({
  title, blurb, best, bestText, onStart, children, result,
}: {
  title: string;
  blurb: string;
  best?: AptitudeScore | null;
  bestText?: (b: AptitudeScore) => string;
  onStart: () => void;
  children?: React.ReactNode;
  result?: React.ReactNode;
}) {
  return (
    <Card className="text-center">
      <div className="label mb-2">{title}</div>
      {result ?? (
        <>
          <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">{blurb}</p>
          {best ? <p className="mt-2 text-xs text-slate-400">Best: {bestText ? bestText(best) : `${best.score}/${best.total}`}</p> : null}
          {children}
          <button className="btn-primary mt-4" onClick={onStart}>Start</button>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Task Switch - the Zap-N style test Optiver uses
// ---------------------------------------------------------------------------

const SWITCH_SECONDS = 60;

export function TaskSwitch({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [running, setRunning] = useState(false);
  const [num, setNum] = useState(0);
  const [rule, setRule] = useState<'odd' | 'high'>('odd');
  const [left, setLeft] = useState(SWITCH_SECONDS);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [result, setResult] = useState<{ correct: number; attempted: number } | null>(null);
  const stateRef = useRef({ num: 0, rule: 'odd' as 'odd' | 'high' });

  const next = useCallback(() => {
    const n = rint(0, 9);
    const r: 'odd' | 'high' = Math.random() < 0.5 ? 'odd' : 'high';
    stateRef.current = { num: n, rule: r };
    setNum(n);
    setRule(r);
  }, []);

  // A single interval drives the clock; answering advances the stimulus.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && left === 0) {
      setRunning(false);
      setResult({ correct, attempted });
      onDone(correct, attempted, SWITCH_SECONDS * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  const answer = (yes: boolean) => {
    const { num: n, rule: r } = stateRef.current;
    const truth = r === 'odd' ? n % 2 === 1 : n > 5;
    const ok = yes === truth;
    setCorrect((c) => c + (ok ? 1 : 0));
    setAttempted((a) => a + 1);
    next();
  };

  const start = () => {
    setCorrect(0); setAttempted(0); setLeft(SWITCH_SECONDS); setResult(null);
    next();
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(true);
      if (e.key === 'ArrowRight') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (result) {
    const pct = Math.round((result.correct / Math.max(1, result.attempted)) * 100);
    return (
      <Shell title="Task switch" blurb="" onStart={start} best={best} bestText={(b) => `${b.score}/${b.total} in ${SWITCH_SECONDS}s`}
        result={
          <>
            <div className="text-4xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{result.attempted}</span></div>
            <p className="mt-1 text-sm text-slate-500">{pct}% correct · {result.attempted} in {SWITCH_SECONDS}s</p>
            <button className="btn-primary mt-4" onClick={start}>Run again</button>
          </>
        }
      />
    );
  }

  if (!running) {
    return (
      <Shell title="Task switch" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="A number appears with a rule that flips at random: blue means answer “is it odd?”, amber means “is it greater than 5?”. This is the Zap-N style task-switching drill Optiver screens with. Use ← for yes and → for no." />
    );
  }

  return (
    <Card className="text-center">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{rule === 'odd' ? 'Is it odd?' : 'Is it greater than 5?'}</span>
        <span className="font-mono text-lg font-bold">{left}s</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div
        className={`mx-auto flex h-36 w-36 items-center justify-center rounded-2xl text-6xl font-bold text-white ${rule === 'odd' ? 'bg-blue-500' : 'bg-amber-500'}`}
      >
        {num}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button className="btn-primary w-28" onClick={() => answer(true)}>Yes (←)</button>
        <button className="btn-primary w-28" onClick={() => answer(false)}>No (→)</button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pincode - digit span (forward / reverse / sorted)
// ---------------------------------------------------------------------------

type SpanMode = 'forward' | 'reverse' | 'sorted';

function applyMode(digits: number[], mode: SpanMode): string {
  if (mode === 'forward') return digits.join('');
  if (mode === 'reverse') return [...digits].reverse().join('');
  return [...digits].sort((a, b) => a - b).join('');
}

export function Pincode({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [mode] = useState<SpanMode>('reverse');
  const [digits, setDigits] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'show' | 'recall' | 'over'>('idle');
  const [typed, setTyped] = useState('');
  const [lives, setLives] = useState(3);
  const [bestSpan, setBestSpan] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const round = useCallback((n: number) => {
    const d = Array.from({ length: n }, () => rint(0, 9));
    setDigits(d);
    setTyped('');
    setPhase('show');
    window.setTimeout(() => setPhase('recall'), Math.max(900, n * 700));
  }, []);

  const start = () => {
    setLives(3); setBestSpan(0); setFlash(null);
    round(3);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const want = applyMode(digits, mode);
    const ok = typed.trim() === want;
    if (ok) {
      const reached = Math.max(bestSpan, digits.length);
      setBestSpan(reached);
      setFlash(null);
      const nextLen = digits.length + 1;
      if (nextLen > 9) {
        setPhase('over');
        onDone(reached, 1, 0);
        return;
      }
      round(nextLen);
    } else {
      const left = lives - 1;
      setLives(left);
      setFlash(`It was ${want}`);
      if (left <= 0) {
        setPhase('over');
        onDone(bestSpan, 1, 0);
        return;
      }
      round(digits.length);
    }
  };

  if (phase === 'over') {
    return (
      <Shell title="Pincode" blurb="" onStart={start} best={best} bestText={(b) => `span ${b.score}`}
        result={
          <>
            <div className="text-4xl font-bold">{bestSpan}</div>
            <p className="mt-1 text-sm text-slate-500">digits held in working memory ({mode})</p>
            <button className="btn-primary mt-4" onClick={start}>Run again</button>
          </>
        }
      />
    );
  }

  if (phase === 'idle') {
    return (
      <Shell title="Pincode" best={best} bestText={(b) => `span ${b.score}`} onStart={start}
        blurb="A digit sequence flashes, then you type it back reversed. This is the digit-span working-memory task used in trading-firm cognitive assessments. Three lives; the span grows until you miss." />
    );
  }

  return (
    <Card className="text-center">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>Span {digits.length}</span>
        <span className="text-red-500">{'♥'.repeat(lives)}</span>
        <span>Best {bestSpan}</span>
      </div>

      <div className="mx-auto flex h-24 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        {phase === 'show' ? (
          <span className="text-4xl font-bold tracking-[0.35em]">{digits.join('')}</span>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              className="input w-44 text-center text-2xl tracking-widest"
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoFocus
              placeholder={mode === 'reverse' ? 'reversed' : mode}
            />
            <button className="btn-primary" type="submit">Go</button>
          </form>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {phase === 'show' ? 'Memorise it…' : `Type the digits ${mode}.`}
      </p>
      {flash && <p className="mt-2 text-sm text-amber-600">{flash}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Grid Recall - spatial working memory with decoys
// ---------------------------------------------------------------------------

const GRID = 5;

export function GridRecall({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [targets, setTargets] = useState<number[]>([]);
  const [decoys, setDecoys] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'show' | 'recall' | 'over'>('idle');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  const startRound = useCallback((r: number) => {
    const cells = Array.from({ length: GRID * GRID }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = rint(0, i);
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const k = Math.min(3 + r, 9);
    const d = Math.min(r, 4);
    setTargets(cells.slice(0, k));
    setDecoys(cells.slice(k, k + d));
    setPicked(new Set());
    setPhase('show');
    window.setTimeout(() => setPhase('recall'), 1300);
  }, []);

  const start = () => {
    setRound(1); setScore(0); setTotal(0);
    startRound(1);
  };

  const toggle = (i: number) => {
    if (phase !== 'recall') return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const confirm = () => {
    let ok = 0;
    for (const t of targets) if (picked.has(t)) ok++;
    for (const d of decoys) if (picked.has(d)) ok--;
    ok = Math.max(0, ok);
    const newScore = score + ok;
    const newTotal = total + targets.length;
    setScore(newScore);
    setTotal(newTotal);
    if (round >= 5) {
      setPhase('over');
      onDone(newScore, newTotal, 0);
      return;
    }
    const r = round + 1;
    setRound(r);
    startRound(r);
  };

  if (phase === 'over') {
    return (
      <Shell title="Grid recall" blurb="" onStart={start} best={best} bestText={(b) => `${b.score}/${b.total}`}
        result={
          <>
            <div className="text-4xl font-bold">{score}<span className="text-lg text-slate-400">/{total}</span></div>
            <p className="mt-1 text-sm text-slate-500">cells recalled correctly across 5 rounds</p>
            <button className="btn-primary mt-4" onClick={start}>Run again</button>
          </>
        }
      />
    );
  }

  if (phase === 'idle') {
    return (
      <Shell title="Grid recall" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="A pattern of blue cells flashes, then you rebuild it. Red cells shown at the same time are decoys - selecting one costs you a point. Five rounds, growing pattern." />
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>Round {round} / 5</span>
        <span className="text-emerald-600">{score} ✓</span>
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-5 gap-1.5">
        {Array.from({ length: GRID * GRID }).map((_, i) => {
          const show = phase === 'show' && (targets.includes(i) || decoys.includes(i));
          const isTarget = targets.includes(i);
          const sel = picked.has(i);
          const bg = show
            ? isTarget ? 'bg-blue-500' : 'bg-red-500'
            : sel
              ? 'bg-indigo-400'
              : 'bg-slate-200 dark:bg-slate-700';
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={phase !== 'recall'}
              className={`h-14 rounded-lg transition ${bg} ${phase === 'recall' ? 'cursor-pointer' : 'cursor-default'}`}
            />
          );
        })}
      </div>
      <div className="mt-4 text-center">
        {phase === 'show' ? (
          <p className="text-sm text-slate-500">Memorise the blue cells — ignore the red ones.</p>
        ) : (
          <>
            <p className="text-xs text-slate-400">Rebuild the pattern ({picked.size} selected).</p>
            <button className="btn-primary mt-2" onClick={confirm}>Confirm</button>
          </>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Flanker - response inhibition (Eriksen flanker task)
// ---------------------------------------------------------------------------

const FLANKER_TRIALS = 30;

export function Flanker({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [running, setRunning] = useState(false);
  const [stim, setStim] = useState<'left' | 'right'>('right');
  const [congruent, setCongruent] = useState(true);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<{ correct: number; ms: number } | null>(null);
  const shownAt = useRef(0);
  const times = useRef<number[]>([]);
  const state = useRef({ dir: 'right' as 'left' | 'right' });

  const next = useCallback(() => {
    const dir: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
    const cong = Math.random() < 0.5;
    state.current = { dir };
    setStim(dir);
    setCongruent(cong);
    shownAt.current = performance.now();
  }, []);

  const start = () => {
    setI(0); setCorrect(0); times.current = []; setResult(null);
    next();
    setRunning(true);
  };

  const answer = (dir: 'left' | 'right') => {
    const ms = performance.now() - shownAt.current;
    times.current.push(ms);
    const ok = dir === state.current.dir;
    const newCorrect = correct + (ok ? 1 : 0);
    setCorrect(newCorrect);
    const n = i + 1;
    setI(n);
    if (n >= FLANKER_TRIALS) {
      setRunning(false);
      const avg = Math.round(times.current.reduce((a, b) => a + b, 0) / times.current.length);
      setResult({ correct: newCorrect, ms: avg });
      onDone(newCorrect, FLANKER_TRIALS, avg);
      return;
    }
    next();
  };

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer('left');
      if (e.key === 'ArrowRight') answer('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, i, correct]);

  if (result) {
    return (
      <Shell title="Response conflict" blurb="" onStart={start} best={best} bestText={(b) => `${b.score}/${b.total} · ${b.ms}ms`}
        result={
          <>
            <div className="text-4xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{FLANKER_TRIALS}</span></div>
            <p className="mt-1 text-sm text-slate-500">{result.ms} ms average · congruent and incongruent mixed</p>
            <button className="btn-primary mt-4" onClick={start}>Run again</button>
          </>
        }
      />
    );
  }

  if (!running) {
    return (
      <Shell title="Response conflict" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="Press the direction of the CENTRE arrow and ignore the flanking arrows. Half the trials are incongruent (e.g. > > < > >), which is where the inhibition cost shows up. Use ← and →." />
    );
  }

  const arrow = stim === 'left' ? '←' : '→';
  const flank = (congruent ? stim : stim === 'left' ? 'right' : 'left') === 'left' ? '←' : '→';

  return (
    <Card className="text-center">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>Trial {i + 1} / {FLANKER_TRIALS}</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div className="flex h-32 items-center justify-center text-5xl font-bold text-slate-700 dark:text-slate-200">
        <span className="text-slate-300 dark:text-slate-600">{flank}</span>
        <span className="text-slate-300 dark:text-slate-600">{flank}</span>
        <span className="mx-3 text-slate-800 dark:text-slate-100">{arrow}</span>
        <span className="text-slate-300 dark:text-slate-600">{flank}</span>
        <span className="text-slate-300 dark:text-slate-600">{flank}</span>
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button className="btn-primary w-24" onClick={() => answer('left')}>←</button>
        <button className="btn-primary w-24" onClick={() => answer('right')}>→</button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Hold Fire - go / no-go with a rule that keeps changing
// ---------------------------------------------------------------------------

const HOLD_TRIALS = 40;

export function HoldFire({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState<'blue' | 'orange'>('blue');
  const [stim, setStim] = useState<'blue' | 'orange'>('blue');
  const [i, setI] = useState(0);
  const [hits, setHits] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [misses, setMisses] = useState(0);
  const [result, setResult] = useState<{ hits: number; fa: number; misses: number } | null>(null);
  const shownAt = useRef(0);
  const state = useRef({ isTarget: true });
  const timer = useRef<number | null>(null);
  // Trial counter mirrored in a ref so the timeouts always read the live value.
  const iRef = useRef(0);

  const next = useCallback((n: number) => {
    // The cue rule flips every 10 trials, so you cannot run on autopilot.
    const t: 'blue' | 'orange' = Math.floor(n / 10) % 2 === 0 ? 'blue' : 'orange';
    const s: 'blue' | 'orange' = Math.random() < 0.6 ? t : t === 'blue' ? 'orange' : 'blue';
    state.current = { isTarget: s === t };
    setTarget(t);
    setStim(s);
    shownAt.current = performance.now();
    // The response window tightens as the run goes on.
    timer.current = window.setTimeout(() => {
      if (state.current.isTarget) {
        setMisses((m) => m + 1);
      }
      const n2 = iRef.current + 1;
      setI(n2);
      if (n2 >= HOLD_TRIALS) {
        setRunning(false);
        return;
      }
      next(n2);
    }, Math.max(550, 1100 - n * 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { iRef.current = i; }, [i]);

  const start = () => {
    setI(0); iRef.current = 0; setHits(0); setFalseAlarms(0); setMisses(0); setResult(null);
    next(0);
    setRunning(true);
  };

  useEffect(() => {
    if (!running && result === null && i > 0) {
      setResult({ hits, fa: falseAlarms, misses });
      onDone(hits, HOLD_TRIALS, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const press = () => {
    if (!running) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (state.current.isTarget) setHits((h) => h + 1);
    else setFalseAlarms((f) => f + 1);
    const n = iRef.current + 1;
    setI(n);
    if (n >= HOLD_TRIALS) {
      setRunning(false);
      return;
    }
    next(n);
  };

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); press(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, i]);

  if (result) {
    const score = Math.max(0, result.hits - result.fa - result.misses);
    return (
      <Shell title="Hold fire" blurb="" onStart={start} best={best} bestText={(b) => `${b.score} pts`}
        result={
          <>
            <div className="text-4xl font-bold">{score}</div>
            <p className="mt-1 text-sm text-slate-500">
              {result.hits} hits · {result.fa} false alarms · {result.misses} misses
            </p>
            <button className="btn-primary mt-4" onClick={start}>Run again</button>
          </>
        }
      />
    );
  }

  if (!running) {
    return (
      <Shell title="Hold fire" best={best} bestText={(b) => `${b.score} pts`} onStart={start}
        blurb="Press space as fast as you can for the target colour, and hold fire for everything else. The cue rule flips every 10 trials and the window tightens. Press space (or click)." />
    );
  }

  return (
    <Card className="text-center">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>Trial {i + 1} / {HOLD_TRIALS}</span>
        <span>Target: <b className={target === 'blue' ? 'text-blue-600' : 'text-orange-600'}>{target}</b></span>
        <span className="text-emerald-600">{hits} ✓</span>
      </div>
      <button
        onClick={press}
        className={`mx-auto flex h-36 w-full max-w-md items-center justify-center rounded-xl font-bold text-white ${stim === 'blue' ? 'bg-blue-500' : 'bg-orange-500'}`}
      >
        {stim === 'blue' ? 'BLUE' : 'ORANGE'}
      </button>
      <p className="mt-3 text-xs text-slate-400">Space or click if it is the target — nothing otherwise.</p>
    </Card>
  );
}
