import { useCallback, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, EmptyState } from '../components/ui';
import type { AptitudeKind, AptitudeScore } from '../models';
import { uid } from '../lib/id';
import { today } from '../lib/date';
import { FIRM_OA } from '../data/aptitudeFirms';
import { Blitz, Patterns, Reaction, Wordle } from '../components/aptitude/Speed';
import { TaskSwitch, Pincode, GridRecall, Flanker, HoldFire } from '../components/aptitude/Cognitive';
import { Fractions, Probability, Fermi, Brainteasers } from '../components/aptitude/Drills';

interface Drill {
  kind: AptitudeKind;
  label: string;
  blurb: string;
}

interface Group {
  group: string;
  note: string;
  drills: Drill[];
}

/**
 * Grouped the way trading-firm prep sites group their assessments: numerical
 * speed, probability/estimation, and the cognitive tests that show up in real
 * online assessments.
 */
const GROUPS: Group[] = [
  {
    group: 'Numerical',
    note: 'Raw number sense — the first thing every mental-math screen tests.',
    drills: [
      { kind: 'blitz', label: '80 in 8', blurb: '80 arithmetic questions in 8 minutes. The Optiver screen.' },
      { kind: 'fractions', label: 'Fractions to decimals', blurb: 'Instant fraction/decimal recall — roughly a quarter of the 80-in-8.' },
      { kind: 'patterns', label: 'Sequence trainer', blurb: 'Find the next term: constant step, geometric, squares, Fibonacci, interleaved.' },
    ],
  },
  {
    group: 'Probability & estimation',
    note: 'The quantitative core of every trading interview.',
    drills: [
      { kind: 'probability', label: 'Probability', blurb: 'Timed expected-value and probability problems.' },
      { kind: 'fermi', label: 'Fermi questions', blurb: 'Order-of-magnitude estimation with worked breakdowns.' },
      { kind: 'brainteaser', label: 'Brainteasers', blurb: 'Classic quant puzzles, including the traps (regions vs intersections).' },
    ],
  },
  {
    group: 'Cognitive',
    note: 'The go/no-go, working-memory and task-switching tasks firms actually put in assessments.',
    drills: [
      { kind: 'taskswitch', label: 'Task switch', blurb: 'Zap-N style: the rule flips at random, you must keep up (Optiver).' },
      { kind: 'pincode', label: 'Pincode', blurb: 'Digit span — memorise a sequence, type it back reversed.' },
      { kind: 'gridrecall', label: 'Grid recall', blurb: 'Spatial working memory with red decoy cells.' },
      { kind: 'flanker', label: 'Response conflict', blurb: 'Act on the centre arrow, ignore the flanks.' },
      { kind: 'holdfire', label: 'Hold fire', blurb: 'Go/no-go with a cue rule that keeps changing.' },
      { kind: 'reaction', label: 'Reaction time', blurb: 'Five trials, average ms. Sub-250ms is competitive.' },
    ],
  },
  {
    group: 'Warm-up',
    note: 'Low-pressure pattern work.',
    drills: [
      { kind: 'wordle', label: 'Wordle', blurb: 'Six guesses at a five-letter word — pattern elimination.' },
    ],
  },
];

const ALL: Drill[] = GROUPS.flatMap((g) => g.drills);

export default function Aptitude() {
  const { state, patch } = useApp();
  const [tab, setTab] = useState<AptitudeKind>('blitz');
  const [showFirms, setShowFirms] = useState(false);
  const scores = (state.aptitudeScores ?? []) as AptitudeScore[];

  const record = useCallback(
    (kind: AptitudeKind, score: number, total: number, ms: number) => {
      patch({ aptitudeScores: [...scores, { id: uid('apt-'), kind, score, total, ms, date: today() }] });
    },
    [patch, scores]
  );

  const bestFor = (kind: AptitudeKind): AptitudeScore | null => {
    const rows = scores.filter((s) => s.kind === kind);
    if (!rows.length) return null;
    return kind === 'reaction'
      ? rows.reduce((a, b) => (a.ms <= b.ms ? a : b))
      : rows.reduce((a, b) => (a.score >= b.score ? a : b));
  };

  const current = ALL.find((d) => d.kind === tab) ?? ALL[0];

  const renderDrill = () => {
    const done = (s: number, t: number, ms: number) => record(tab, s, t, ms);
    switch (tab) {
      case 'blitz': return <Blitz best={bestFor('blitz')} onDone={done} />;
      case 'fractions': return <Fractions best={bestFor('fractions')} onDone={done} />;
      case 'patterns': return <Patterns best={bestFor('patterns')} onDone={done} />;
      case 'probability': return <Probability best={bestFor('probability')} onDone={done} />;
      case 'fermi': return <Fermi best={bestFor('fermi')} onDone={done} />;
      case 'brainteaser': return <Brainteasers best={bestFor('brainteaser')} onDone={done} />;
      case 'taskswitch': return <TaskSwitch best={bestFor('taskswitch')} onDone={done} />;
      case 'pincode': return <Pincode best={bestFor('pincode')} onDone={done} />;
      case 'gridrecall': return <GridRecall best={bestFor('gridrecall')} onDone={done} />;
      case 'flanker': return <Flanker best={bestFor('flanker')} onDone={done} />;
      case 'holdfire': return <HoldFire best={bestFor('holdfire')} onDone={done} />;
      case 'reaction': return <Reaction best={bestFor('reaction')} onDone={done} />;
      case 'wordle': return <Wordle best={bestFor('wordle')} onDone={done} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Aptitude Lab</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          The speed, probability and cognitive screens trading firms use to shortlist — arithmetic
          blitz, number series, probability, estimation, and the task-switching and working-memory
          tasks that appear in real online assessments. Every run is logged so you can see the trend.
        </p>
      </div>

      {/* Drill picker, grouped by category */}
      <div className="grid gap-3 lg:grid-cols-4">
        {GROUPS.map((g) => (
          <Card key={g.group} className="p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.group}</div>
            <p className="mb-2 text-[11px] leading-snug text-slate-400">{g.note}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.drills.map((d) => (
                <button
                  key={d.kind}
                  onClick={() => setTab(d.kind)}
                  title={d.blurb}
                  className={`chip ${tab === d.kind ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{current.blurb}</p>
        {renderDrill()}
      </div>

      {/* Which firms use which tests */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>What each firm actually tests</SectionTitle>
          <button className="btn-ghost text-xs" onClick={() => setShowFirms((v) => !v)}>
            {showFirms ? 'Hide' : 'Show'}
          </button>
        </div>
        {showFirms ? (
          <>
            <p className="mb-3 text-xs text-slate-400">
              Formats change between cycles and differ by region and role — check the firm's own
              careers page before your assessment. Click a drill below to jump straight to it.
            </p>
            <div className="space-y-3">
              {FIRM_OA.map((f) => (
                <div key={f.firm} className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{f.firm}</div>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{f.tests}</p>
                  {f.note && <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">{f.note}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.drills.map((k) => {
                      const d = ALL.find((x) => x.kind === k);
                      if (!d) return null;
                      return (
                        <button key={k} onClick={() => setTab(k)} className="chip bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300">
                          {d.label} →
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">
            Optiver, Jane Street, IMC, Akuna, Flow Traders, SIG, DRW, Mako and more — mapped to the
            drills that prepare for each.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>Recent runs</SectionTitle>
        {scores.length === 0 ? (
          <EmptyState>No runs logged yet — your scores and times will collect here.</EmptyState>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {[...scores].reverse().slice(0, 30).map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {s.date} · {ALL.find((d) => d.kind === s.kind)?.label ?? s.kind}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatRun(s)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Each drill reports score/total/ms, but they mean different things. */
function formatRun(s: AptitudeScore): string {
  switch (s.kind) {
    case 'reaction':
      return `${s.ms} ms avg`;
    case 'wordle':
      return s.score === 1 ? `solved in ${s.total}` : 'missed';
    case 'pincode':
      return `span ${s.score}`;
    case 'holdfire':
      return `${s.score} pts`;
    case 'fermi':
      return `${s.score}/${s.total} within an order of magnitude`;
    case 'blitz':
      return `${s.score}/${s.total} in ${(s.ms / 1000).toFixed(0)}s`;
    default:
      return `${s.score}/${s.total}${s.ms ? ` · ${(s.ms / 1000).toFixed(0)}s` : ''}`;
  }
}
