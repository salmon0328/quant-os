/**
 * Browser-side client for /api/ai.
 *
 * Every AI feature in the app is additive: when the server has no
 * OPENROUTER_API_KEY, `aiAvailable()` resolves false and callers fall back to
 * the behaviour the app had before AI existed. Nothing here may become a
 * dependency of the core planner/drill loops.
 */
import { supabase } from './supabaseClient';

export interface GradeResult {
  score: 0 | 1 | 2 | 3;
  verdict: string;
  missed: string[];
  wrong: string[];
  nitpick?: string | null;
}

export interface FollowUpResult {
  question: string;
  why: string;
  answer: string;
}

export interface GeneratedQuestion {
  q: string;
  a: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface MoveExplanation {
  chain: string[];
  perAsset: { symbol: string; why: string }[];
  watchNext: string[];
  confidence: 'high' | 'medium' | 'low';
  critique?: string | null;
}

export interface EstimateGrade {
  referenceEstimate: string;
  withinOrderOfMagnitude: boolean;
  decompositionScore: 0 | 1 | 2 | 3;
  goodMoves: string[];
  feedback: string;
}

/** Thrown for every failure mode so callers have one thing to catch. */
export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

// ------------------------------------------------------------ availability

let availability: Promise<boolean> | undefined;

/** Cached for the session — the server's configuration does not change under us. */
export function aiAvailable(): Promise<boolean> {
  availability ??= fetch('/api/ai')
    .then((res) => (res.ok ? res.json() : { configured: false }))
    .then((body: { configured?: boolean }) => Boolean(body.configured))
    .catch(() => false);
  return availability;
}

// ------------------------------------------------------------------ caller

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function run<T>(task: string, payload: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ task, payload }),
    });
  } catch {
    throw new AiError('Could not reach the AI service — check your connection.');
  }

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    data?: T;
    text?: string;
  };

  if (!res.ok || !body.ok) {
    // A 503 means the key is missing: stop offering AI for the rest of the session.
    if (res.status === 503) availability = Promise.resolve(false);
    throw new AiError(body.error ?? `AI request failed (${res.status}).`, res.status);
  }

  return (body.data ?? (body.text as unknown)) as T;
}

// ------------------------------------------------------------------- tasks

export const gradeAnswer = (p: {
  question: string;
  modelAnswer: string;
  userAnswer: string;
  topic?: string;
}) => run<GradeResult>('gradeAnswer', p);

export const followUp = (p: {
  question: string;
  modelAnswer: string;
  userAnswer?: string;
  topic?: string;
}) => run<FollowUpResult>('followUp', p);

export const generateQuestions = (p: {
  topic: string;
  syllabus?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  count?: number;
  exclude?: string[];
}) => run<{ questions: GeneratedQuestion[] }>('generateQuestions', p);

export const explainMove = (p: {
  date: string;
  moves: { symbol: string; changePct: number }[];
  headlines: string[];
  userDraft?: string;
}) => run<MoveExplanation>('explainMove', p);

export const explainConcept = (p: {
  concept: string;
  context?: string;
  level: 'nudge' | 'approach' | 'full';
}) => run<string>('explainConcept', p);

export const gradeEstimate = (p: {
  prompt: string;
  userAnswer: string;
  userWorking?: string;
}) => run<EstimateGrade>('gradeEstimate', p);
