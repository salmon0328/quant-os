/**
 * Shared implementation behind POST /api/ai.
 *
 * Lives in _lib (not as a route) so the Vercel function and the Vite dev
 * middleware run exactly the same code — the same arrangement the calendar
 * proxy uses.
 *
 * This is the first server secret in the repo and the deployed URL is public,
 * so the route is locked down three ways:
 *   1. Only the task names in AI_TASKS are accepted, and prompts are built
 *      server-side — there is no free-form prompt passthrough.
 *   2. Callers must present a valid Supabase access token (skipped for the
 *      local dev middleware, which is not reachable from the internet).
 *   3. Per-caller rate limiting and a hard output-token cap.
 */
import { chat, isLlmConfigured } from './llm.js';
import { buildPrompt, isAiTask, type AiTask } from './prompts.js';

export interface AiHandlerOptions {
  /** False only for the localhost dev middleware. */
  requireAuth: boolean;
}

export interface AiResult {
  status: number;
  body: {
    ok: boolean;
    error?: string;
    /** Parsed JSON for json tasks, or `{ text }` for prose tasks. */
    data?: unknown;
    text?: string;
    model?: string;
  };
}

/**
 * Cheap, unauthenticated probe so the UI can hide AI affordances up front
 * instead of offering a button that always fails. Deliberately leaks nothing
 * beyond "is a key present".
 */
export function aiStatus(): { ok: true; configured: boolean } {
  return { ok: true, configured: isLlmConfigured() };
}

// --------------------------------------------------------------- rate limit

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

/**
 * Per-instance, in-memory. A serverless instance is short-lived so this is a
 * guard against a runaway client loop, not a billing control — the real
 * spend cap belongs on the OpenRouter key itself.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

// -------------------------------------------------------------------- auth

/**
 * Verifies a Supabase access token against the project's auth endpoint.
 * Done with a plain fetch rather than @supabase/supabase-js so the serverless
 * bundle stays small and the api/ tsconfig keeps its Node-only lib set.
 */
async function verifyToken(token: string): Promise<{ ok: boolean; userId?: string }> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false };

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return { ok: false };
    const user = (await res.json()) as { id?: string };
    return user.id ? { ok: true, userId: user.id } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function bearer(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? '');
  return match?.[1];
}

// ---------------------------------------------------------------- handler

export async function handleAi(
  body: unknown,
  authHeader: string | undefined,
  opts: AiHandlerOptions
): Promise<AiResult> {
  if (!isLlmConfigured()) {
    return {
      status: 503,
      body: { ok: false, error: 'AI is not configured on this deployment (OPENROUTER_API_KEY is unset).' },
    };
  }

  let caller = 'local';
  if (opts.requireAuth) {
    const token = bearer(authHeader);
    if (!token) return { status: 401, body: { ok: false, error: 'Sign in to use AI features.' } };
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      // Refusing is the safe default: without a way to verify the caller this
      // route would be an open, billable LLM proxy.
      return {
        status: 503,
        body: { ok: false, error: 'AI is unavailable: SUPABASE_URL / SUPABASE_ANON_KEY are not set on the server, so callers cannot be verified.' },
      };
    }
    const auth = await verifyToken(token);
    if (!auth.ok) return { status: 401, body: { ok: false, error: 'Your session has expired — sign in again.' } };
    caller = auth.userId!;
  }

  if (rateLimited(caller)) {
    return { status: 429, body: { ok: false, error: 'Too many AI requests in the last minute — give it a moment.' } };
  }

  const { task, payload } = (body ?? {}) as { task?: unknown; payload?: unknown };
  if (!isAiTask(task)) {
    return { status: 400, body: { ok: false, error: `Unknown AI task: ${String(task)}` } };
  }

  const spec = buildPrompt(task as AiTask, payload);
  if (!spec) {
    return { status: 400, body: { ok: false, error: `Missing or empty fields for the "${task}" task.` } };
  }

  const result = await chat({
    messages: [
      { role: 'system', content: spec.system },
      { role: 'user', content: spec.user },
    ],
    tier: spec.tier,
    maxTokens: spec.maxTokens,
    json: spec.json,
  });

  if (!result.ok) {
    return { status: 502, body: { ok: false, error: result.error ?? 'The model call failed.', model: result.model } };
  }

  return {
    status: 200,
    body: spec.json
      ? { ok: true, data: result.data, model: result.model }
      : { ok: true, text: result.text, model: result.model },
  };
}
