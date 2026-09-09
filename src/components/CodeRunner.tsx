import { useState } from 'react';
import type { Exercise } from '../models';
import { runPython, type RunResult } from '../lib/pyodide';

/**
 * A runnable Python exercise.
 *
 * Hidden assertions decide pass/fail, so "it printed something" is not mistaken
 * for "it works" — which is the whole difference between a notebook and an
 * exercise.
 */
export function CodeRunner({ exercise }: { exercise: Exercise }) {
  const [code, setCode] = useState(exercise.starterCode);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const run = async (withTests: boolean) => {
    setRunning(true);
    setResult(null);
    const res = await runPython(code, withTests ? exercise.tests : undefined);
    setResult(res);
    setBooted(true);
    setRunning(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="font-medium text-slate-800 dark:text-slate-100">{exercise.title}</div>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{exercise.prompt}</p>

      <textarea
        className="input mt-3 w-full font-mono text-xs"
        rows={Math.min(20, Math.max(8, code.split('\n').length + 2))}
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={running} onClick={() => void run(true)}>
          {running ? 'Running…' : 'Run & check'}
        </button>
        <button className="btn-ghost" disabled={running} onClick={() => void run(false)}>
          Run only
        </button>
        <button className="btn-ghost" onClick={() => { setCode(exercise.starterCode); setResult(null); }}>
          Reset
        </button>
        {exercise.hint && (
          <button className="btn-ghost text-xs" onClick={() => setShowHint(!showHint)}>
            {showHint ? 'Hide hint' : 'Hint'}
          </button>
        )}
        <button className="btn-ghost text-xs" onClick={() => setShowSolution(!showSolution)}>
          {showSolution ? 'Hide solution' : 'Solution'}
        </button>
        {!booted && !running && (
          <span className="text-[11px] text-slate-400">
            First run downloads Python (~10MB) — later runs are instant.
          </span>
        )}
      </div>

      {showHint && exercise.hint && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {exercise.hint}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          {result.output && (
            <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{result.output}</pre>
          )}
          {result.error ? (
            <div className="rounded bg-red-50 p-2 text-xs dark:bg-red-500/10">
              <div className="font-semibold text-red-600 dark:text-red-400">
                {result.error.includes('AssertionError') ? 'Tests failed' : 'Error'}
              </div>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-300">{result.error}</pre>
            </div>
          ) : (
            <div className="rounded bg-emerald-50 p-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              ✓ All checks passed
            </div>
          )}
        </div>
      )}

      {showSolution && (
        <pre className="mt-3 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">{exercise.solution}</pre>
      )}
    </div>
  );
}
