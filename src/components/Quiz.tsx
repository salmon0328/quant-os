import { useMemo, useState } from 'react';
import type { Module, QuizQuestion } from '../models';
import { aiAvailable, gradeAnswer, AiError, type GradeResult } from '../lib/ai';
import { useEffect } from 'react';

/**
 * Module quiz. MCQ and numeric are graded locally; free-text is sent to the
 * marker when AI is available and falls back to self-grading when it is not.
 *
 * Questions carry the glossary term they test, so a miss can be pushed into the
 * drill's review queue — which is what closes the loop between Learn and Drill.
 */
export function Quiz({
  module: mod,
  onFinish,
}: {
  module: Module;
  onFinish: (result: { correct: number; total: number; ms: number; missedIds: string[]; concepts: string[] }) => void;
}) {
  const questions = mod.quiz;
  const [i, setI] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [answer, setAnswer] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState<{ correct: boolean; note?: string } | null>(null);
  const [missed, setMissed] = useState<QuizQuestion[]>([]);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void aiAvailable().then(setAiOn); }, []);

  const q = questions[i];
  const numericTarget = useMemo(() => (q?.kind === 'numeric' ? Number(q.answer) : NaN), [q]);

  if (questions.length === 0) {
    return <p className="text-sm text-slate-400">No quiz for this module yet.</p>;
  }

  const check = async () => {
    if (!q || checked) return;

    if (q.kind === 'mcq') {
      setChecked({ correct: choice === q.answerIndex });
      if (choice === q.answerIndex) setCorrect((c) => c + 1);
      else setMissed((m) => [...m, q]);
      return;
    }

    if (q.kind === 'numeric') {
      const given = Number(answer.replace(/[, ]/g, ''));
      // Default to a 1% relative tolerance so 0.0400 and 0.04 both pass.
      const tol = q.tolerance ?? Math.abs(numericTarget) * 0.01;
      const ok = Number.isFinite(given) && Math.abs(given - numericTarget) <= Math.max(tol, 1e-9);
      setChecked({ correct: ok });
      if (ok) setCorrect((c) => c + 1);
      else setMissed((m) => [...m, q]);
      return;
    }

    // Free text: graded by the marker when it is available.
    if (!aiOn) {
      setChecked({ correct: false, note: 'Compare with the model answer and mark yourself.' });
      return;
    }
    setBusy(true);
    try {
      const graded: GradeResult = await gradeAnswer({
        question: q.prompt,
        modelAnswer: q.answer ?? q.explanation,
        userAnswer: answer,
        topic: mod.title,
      });
      const ok = graded.score >= 2;
      setChecked({
        correct: ok,
        note: `${graded.score}/3 — ${graded.verdict}${graded.missed?.length ? ` Missed: ${graded.missed.join('; ')}` : ''}`,
      });
      if (ok) setCorrect((c) => c + 1);
      else setMissed((m) => [...m, q]);
    } catch (e) {
      setChecked({ correct: false, note: e instanceof AiError ? e.message : 'Marking failed — grade yourself.' });
    } finally {
      setBusy(false);
    }
  };

  /** Used when free-text grading was unavailable and the user marks themselves. */
  const selfMark = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1);
    else setMissed((m) => [...m, q]);
    next();
  };

  const next = () => {
    setChecked(null);
    setAnswer('');
    setChoice(null);
    if (i + 1 >= questions.length) {
      setDone(true);
      onFinish({
        correct,
        total: questions.length,
        ms: Date.now() - startedAt,
        missedIds: missed.map((m) => m.id),
        concepts: [...new Set(missed.map((m) => m.concept).filter((c): c is string => !!c))],
      });
      return;
    }
    setI(i + 1);
  };

  if (done) {
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div className="space-y-3">
        <div className={`rounded-lg p-3 text-sm font-semibold ${pct >= 70 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
          {correct}/{questions.length} correct ({pct}%)
        </div>
        {missed.length > 0 && (
          <div>
            <div className="label text-amber-600">Review these</div>
            <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {missed.map((m) => <li key={m.id}>• {m.prompt}</li>)}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">
              The concepts behind these have been queued in the Interview Drill.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Question {i + 1} of {questions.length}</span>
        <span>{correct} correct</span>
      </div>

      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.prompt}</div>

      {q.kind === 'mcq' && q.choices && (
        <div className="space-y-1.5">
          {q.choices.map((c, k) => {
            const isAnswer = checked && k === q.answerIndex;
            const isWrongPick = checked && k === choice && k !== q.answerIndex;
            return (
              <button
                key={k}
                disabled={!!checked}
                onClick={() => setChoice(k)}
                className={`block w-full rounded-lg border p-2 text-left text-sm transition ${
                  isAnswer ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                  : isWrongPick ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                  : choice === k ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'numeric' && (
        <input
          className="input w-full"
          placeholder="Your answer (a number)"
          value={answer}
          disabled={!!checked}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )}

      {q.kind === 'free' && (
        <textarea
          className="input w-full"
          rows={4}
          placeholder="Answer in a few sentences…"
          value={answer}
          disabled={!!checked}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )}

      {checked && (
        <div className={`rounded-lg p-2 text-xs ${checked.correct ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
          <div className={`font-semibold ${checked.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {checked.note ?? (checked.correct ? 'Correct' : 'Not quite')}
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">{q.explanation}</p>
        </div>
      )}

      <div className="flex gap-2">
        {!checked ? (
          <button
            className="btn-primary"
            disabled={busy || (q.kind === 'mcq' ? choice === null : !answer.trim())}
            onClick={() => void check()}
          >
            {busy ? 'Marking…' : 'Check'}
          </button>
        ) : checked.note && !checked.correct && q.kind === 'free' && !aiOn ? (
          <>
            <button className="btn-ghost text-red-500" onClick={() => selfMark(false)}>Got it wrong</button>
            <button className="btn-primary" onClick={() => selfMark(true)}>Got it right</button>
          </>
        ) : (
          <button className="btn-primary" onClick={next}>
            {i + 1 >= questions.length ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}
