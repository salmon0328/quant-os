import { useRef, useState } from 'react';
import { Card } from '../../components/ui';
import type { AptitudeScore } from '../../models';
import { BRAINTEASERS, FERMI, PROBABILITY, type Brainteaser, type FermiQuestion, type ProbabilityQuestion } from '../../data/aptitudeFirms';

type Done = (score: number, total: number, ms: number) => void;

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rint(a: number, b: number) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Idle -> question/result shell shared by the quiz-style drills. */
function QuizShell({
  title, blurb, best, bestText, onStart, children,
}: {
  title: string;
  blurb: string;
  best?: AptitudeScore | null;
  bestText?: (b: AptitudeScore) => string;
  onStart: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card className="text-center">
      <div className="label mb-2">{title}</div>
      <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">{blurb}</p>
      {best ? <p className="mt-2 text-xs text-slate-400">Best: {bestText ? bestText(best) : `${best.score}/${best.total}`}</p> : null}
      {children}
      <button className="btn-primary mt-4" onClick={onStart}>Start</button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fractions to decimals
// ---------------------------------------------------------------------------

// Denominators that are products of 2s and 5s, so the decimal terminates and
// the drill is about instant recall rather than rounding.
const DENOMS = [2, 4, 5, 8, 10, 16, 20, 25, 40, 50, 80, 100, 125, 200, 400, 800];

/** Exact decimal of n/d via long division - avoids float artefacts like 0.0625000001. */
function decimalOf(n: number, d: number): string {
  const sign = n < 0 ? '-' : '';
  let num = Math.abs(n);
  const intPart = Math.floor(num / d);
  let rem = num % d;
  let frac = '';
  const seen = new Map<number, number>();
  while (rem !== 0 && !seen.has(rem)) {
    seen.set(rem, frac.length);
    rem *= 10;
    frac += String(Math.floor(rem / d));
    rem %= d;
  }
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

function fractionQuestion(): { n: number; d: number; text: string; answer: string } {
  const d = DENOMS[Math.floor(Math.random() * DENOMS.length)];
  let n = rint(1, d - 1);
  // Keep it to the ones worth memorising rather than e.g. 317/400.
  if (d >= 100 && Math.random() < 0.6) n = rint(1, 12);
  return { n, d, text: `${n}/${d}`, answer: decimalOf(n, d) };
}

export function Fractions({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TOTAL = 15;
  const [qs, setQs] = useState<ReturnType<typeof fractionQuestion>[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: number; ms: number } | null>(null);
  const startedAt = useRef(0);

  const start = () => {
    setQs(Array.from({ length: TOTAL }, fractionQuestion));
    setI(0); setTyped(''); setCorrect(0); setFeedback(null); setResult(null);
    startedAt.current = Date.now();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qs[i];
    if (!q) return;
    const ok = typed.trim().replace(/\s/g, '') === q.answer || Number(typed) === Number(q.answer);
    const c = correct + (ok ? 1 : 0);
    setCorrect(c);
    setFeedback(ok ? 'Correct' : `${q.text} = ${q.answer}`);
    setTyped('');
    window.setTimeout(() => {
      setFeedback(null);
      if (i + 1 >= TOTAL) {
        const ms = Date.now() - startedAt.current;
        setResult({ correct: c, ms });
        onDone(c, TOTAL, ms);
        return;
      }
      setI((k) => k + 1);
    }, ok ? 400 : 1500);
  };

  if (result) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Fractions to decimals</div>
        <div className="text-4xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{TOTAL}</span></div>
        <p className="mt-1 text-sm text-slate-500">in {(result.ms / 1000).toFixed(0)}s</p>
        <button className="btn-primary mt-4" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!qs.length) {
    return (
      <QuizShell title="Fractions to decimals" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="Convert fractions to decimals until it is instant. A core mental-math skill - fractions are roughly a quarter of the Optiver 80-in-8." />
    );
  }

  const q = qs[i];
  return (
    <Card className="text-center">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{i + 1} / {TOTAL}</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div className="text-4xl font-bold text-slate-800 dark:text-slate-100">{q.text}</div>
      <form onSubmit={submit} className="mt-4 flex items-center justify-center gap-2">
        <input
          className="input w-40 text-center text-xl"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^0-9.\-]/g, ''))}
          inputMode="decimal"
          autoFocus
          placeholder="0.00"
        />
        <button className="btn-primary" type="submit">Go</button>
      </form>
      {feedback && <p className={`mt-3 text-sm ${feedback === 'Correct' ? 'text-emerald-600' : 'text-amber-600'}`}>{feedback}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Probability trainer
// ---------------------------------------------------------------------------

export function Probability({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TOTAL = 10;
  const [qs, setQs] = useState<ProbabilityQuestion[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{ correct: number; ms: number } | null>(null);
  const startedAt = useRef(0);

  const start = () => {
    setQs(shuffle(PROBABILITY).slice(0, TOTAL));
    setI(0); setTyped(''); setCorrect(0); setRevealed(false); setResult(null);
    startedAt.current = Date.now();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qs[i];
    if (!q) return;
    const got = Number(typed);
    const tol = q.tol ?? 0.01;
    const ok = Number.isFinite(got) && Math.abs(got - q.a) <= Math.max(tol, Math.abs(q.a) * 0.02);
    setRevealed(true);
    setCorrect((c) => c + (ok ? 1 : 0));
  };

  const advance = () => {
    setTyped('');
    setRevealed(false);
    if (i + 1 >= TOTAL) {
      const ms = Date.now() - startedAt.current;
      setResult({ correct, ms });
      onDone(correct, TOTAL, ms);
      return;
    }
    setI((k) => k + 1);
  };

  if (result) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Probability</div>
        <div className="text-4xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{TOTAL}</span></div>
        <p className="mt-1 text-sm text-slate-500">in {(result.ms / 1000).toFixed(0)}s</p>
        <button className="btn-primary mt-4" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!qs.length) {
    return (
      <QuizShell title="Probability" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="Timed probability and expected-value problems. Give a decimal (0.333 works as well as 1/3's decimal) - the point is fast, correct intuition, so the derivation is shown after each one." />
    );
  }

  const q = qs[i];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{i + 1} / {TOTAL}</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div className="text-base font-medium leading-snug text-slate-800 dark:text-slate-100">{q.q}</div>

      {revealed ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-800/60">
            <b>Answer:</b> {q.a.toPrecision(4).replace(/\.?0+$/, '')} — {q.why}
          </div>
          <button className="btn-primary w-full" onClick={advance}>Next</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex items-center gap-2">
          <input
            className="input w-40 text-center text-lg"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^0-9.\-\/]/g, ''))}
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
          />
          <button className="btn-primary" type="submit">Answer</button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fermi questions
// ---------------------------------------------------------------------------

export function Fermi({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TOTAL = 6;
  const [qs, setQs] = useState<FermiQuestion[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [hits, setHits] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{ hits: number } | null>(null);
  const startedAt = useRef(0);

  const start = () => {
    setQs(shuffle(FERMI).slice(0, TOTAL));
    setI(0); setTyped(''); setHits(0); setRevealed(false); setResult(null);
    startedAt.current = Date.now();
  };

  const withinOneOrder = (guess: number, truth: number) => {
    if (!(guess > 0) || !(truth > 0)) return false;
    return Math.abs(Math.log10(guess) - Math.log10(truth)) <= 1;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setRevealed(true);
    const k = Number(typed.replace(/[,_\s]/g, ''));
    if (Number.isFinite(k) && withinOneOrder(k, qs[i].estimate)) setHits((h) => h + 1);
  };

  const advance = () => {
    setTyped('');
    setRevealed(false);
    if (i + 1 >= TOTAL) {
      setResult({ hits });
      onDone(hits, TOTAL, Date.now() - startedAt.current);
      return;
    }
    setI((k) => k + 1);
  };

  if (result) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Fermi questions</div>
        <div className="text-4xl font-bold">{result.hits}<span className="text-lg text-slate-400">/{TOTAL}</span></div>
        <p className="mt-1 text-sm text-slate-500">within one order of magnitude</p>
        <button className="btn-primary mt-4" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!qs.length) {
    return (
      <QuizShell title="Fermi questions" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="Order-of-magnitude estimation: break the unknown into parts and defend a number. You score if you are within one order of magnitude - the reasoning matters more than the value." />
    );
  }

  const q = qs[i];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{i + 1} / {TOTAL}</span>
        <span className="text-emerald-600">{hits} ✓</span>
      </div>
      <div className="text-base font-medium leading-snug text-slate-800 dark:text-slate-100">{q.q}</div>

      {revealed ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-800/60">
            <b>Order of magnitude:</b> ~{q.estimate.toExponential(1).replace(/e\+?/, ' × 10^')} {q.unit}
            <p className="mt-2 text-slate-600 dark:text-slate-300">{q.breakdown}</p>
          </div>
          <button className="btn-primary w-full" onClick={advance}>Next</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex items-center gap-2">
          <input
            className="input w-44 text-center text-lg"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^0-9.eE+\-,\s]/g, ''))}
            autoFocus
            placeholder="your estimate"
          />
          <span className="text-sm text-slate-400">{q.unit}</span>
          <button className="btn-primary" type="submit">Answer</button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Brainteasers
// ---------------------------------------------------------------------------

export function Brainteasers({ best, onDone }: { best: AptitudeScore | null; onDone: Done }) {
  const TOTAL = 8;
  const [qs, setQs] = useState<Brainteaser[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<{ correct: number } | null>(null);
  const startedAt = useRef(0);

  const start = () => {
    setQs(shuffle(BRAINTEASERS).slice(0, TOTAL));
    setI(0); setPicked(null); setCorrect(0); setResult(null);
    startedAt.current = Date.now();
  };

  const choose = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === qs[i].correct) setCorrect((c) => c + 1);
  };

  const advance = () => {
    setPicked(null);
    if (i + 1 >= TOTAL) {
      setResult({ correct });
      onDone(correct, TOTAL, Date.now() - startedAt.current);
      return;
    }
    setI((k) => k + 1);
  };

  if (result) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Brainteasers</div>
        <div className="text-4xl font-bold">{result.correct}<span className="text-lg text-slate-400">/{TOTAL}</span></div>
        <button className="btn-primary mt-4" onClick={start}>Run again</button>
      </Card>
    );
  }

  if (!qs.length) {
    return (
      <QuizShell title="Brainteasers" best={best} bestText={(b) => `${b.score}/${b.total}`} onStart={start}
        blurb="The classic quant brainteasers reported at Jane Street, SIG, Optiver and Citadel. The explanation is the real content - including the traps (regions vs intersections, and the sequences that look symmetric but are not)." />
    );
  }

  const q = qs[i];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{i + 1} / {TOTAL}</span>
        <span className="text-emerald-600">{correct} ✓</span>
      </div>
      <div className="text-base font-medium leading-snug text-slate-800 dark:text-slate-100">{q.q}</div>

      <div className="mt-4 space-y-2">
        {q.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isRight = idx === q.correct;
          const bg = picked === null
            ? 'hover:border-indigo-400 border-slate-200 dark:border-slate-700'
            : isRight
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
              : isPicked
                ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                : 'border-slate-200 dark:border-slate-700';
          return (
            <button
              key={idx}
              onClick={() => choose(idx)}
              disabled={picked !== null}
              className={`w-full rounded-lg border p-3 text-left text-sm ${bg}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-800/60">
            {q.why}
          </div>
          <button className="btn-primary w-full" onClick={advance}>Next</button>
        </div>
      )}
    </Card>
  );
}
