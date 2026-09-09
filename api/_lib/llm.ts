/**
 * LLM client — the single place the app talks to a language model.
 *
 * Provider-agnostic: it speaks the OpenAI chat/completions shape, so it works
 * against 9Router (the default, running locally on :20128), OpenRouter, or any
 * other OpenAI-compatible gateway, by changing LLM_BASE_URL alone.
 *
 * It lives under api/_lib because LLM_API_KEY is a server secret: it must
 * never reach the browser bundle.
 *
 * NOTE: the default base URL is localhost. A Vercel function cannot reach a
 * gateway running on your laptop, so a deployed build needs LLM_BASE_URL
 * pointed at something publicly reachable — otherwise AI features are
 * local-only and the app hides them (see aiStatus / src/lib/ai.ts).
 */

const DEFAULT_BASE_URL = 'http://localhost:20128/v1';
const FETCH_TIMEOUT_MS = 45_000;

/** Hard ceiling regardless of what a caller asks for — a runaway loop is expensive. */
const MAX_OUTPUT_TOKENS = 4_000;

/**
 * Thinking models spend part of the budget on reasoning tokens before emitting
 * any content, so a tight max_tokens yields an empty completion. Every request
 * gets this much headroom on top of what the caller asked for.
 */
const REASONING_HEADROOM = 600;

export type Role = 'system' | 'user' | 'assistant';
export interface Message {
  role: Role;
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  /** 'fast' for grading/hints, 'smart' for generation. Resolved from env. */
  tier?: 'fast' | 'smart';
  /** Explicit model id, overriding the tier. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object back and parse it defensively. */
  json?: boolean;
}

export interface ChatResult {
  ok: boolean;
  error?: string;
  /** Raw assistant text. */
  text?: string;
  /** Present when `json` was requested and parsing succeeded. */
  data?: unknown;
  model?: string;
  usage?: { prompt: number; completion: number };
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

function endpoint(): string {
  const base = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

function modelFor(opts: ChatOptions): string {
  if (opts.model) return opts.model;
  return opts.tier === 'smart'
    ? process.env.LLM_MODEL_SMART || 'ag/gemini-3.1-pro-low'
    : process.env.LLM_MODEL_FAST || 'ag/gemini-3.8-flash';
}

/**
 * Models wrap JSON in prose or fences often enough that a bare JSON.parse is
 * not good enough. Take the outermost balanced {...} or [...] and parse that.
 */
export function parseJsonLoose(raw: string): unknown | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to bracket extraction */
  }
  const start = text.search(/[[{]/);
  if (start === -1) return undefined;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

interface Completion {
  text: string;
  usage: { prompt: number; completion: number };
}

/**
 * Normalises a completion response into text plus usage.
 *
 * 9Router answers with text/event-stream even when streaming was not
 * requested, so a plain JSON.parse fails on every call. Reassemble the deltas
 * when the body is SSE, and report an error chunk rather than an empty string.
 */
export function readCompletion(raw: string): Completion | { error: string } {
  const body = raw.trim();
  if (!body) return { error: 'The gateway returned an empty response.' };

  const usage = { prompt: 0, completion: 0 };

  if (!body.startsWith('data:')) {
    try {
      const json = JSON.parse(body) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };
      if (json.error) return { error: json.error.message ?? 'Unknown gateway error.' };
      const text = json.choices?.[0]?.message?.content;
      if (!text) return { error: 'The model returned an empty response.' };
      return {
        text,
        usage: { prompt: json.usage?.prompt_tokens ?? 0, completion: json.usage?.completion_tokens ?? 0 },
      };
    } catch {
      return { error: `The gateway returned non-JSON: ${body.slice(0, 200)}` };
    }
  }

  let text = '';
  let finish: string | undefined;
  let reasoning = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let chunk: {
      choices?: { delta?: { content?: string }; finish_reason?: string }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
      error?: { message?: string } | string;
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue;
    }
    if (chunk.error) {
      const message = typeof chunk.error === 'string' ? chunk.error : chunk.error.message;
      return { error: message ?? 'Unknown gateway error.' };
    }
    if (chunk.usage) {
      usage.prompt = chunk.usage.prompt_tokens ?? usage.prompt;
      usage.completion = chunk.usage.completion_tokens ?? usage.completion;
      reasoning = chunk.usage.completion_tokens_details?.reasoning_tokens ?? reasoning;
    }
    for (const choice of chunk.choices ?? []) {
      text += choice.delta?.content ?? '';
      finish = choice.finish_reason ?? finish;
    }
  }

  if (!text) {
    const hint = reasoning ? ` It spent ${reasoning} tokens reasoning — max_tokens is too low.` : '';
    return { error: `The model produced no content (finish_reason: ${finish ?? 'unknown'}).${hint}` };
  }
  return { text, usage };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.LLM_API_KEY;
  if (!key) return { ok: false, error: 'AI is not configured (LLM_API_KEY is unset).' };

  const model = modelFor(opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Attribution headers: used by OpenRouter's dashboard, ignored by
        // gateways that don't know them.
        'X-Title': 'Quant-OS',
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: Math.min((opts.maxTokens ?? 1_000) + REASONING_HEADROOM, MAX_OUTPUT_TOKENS),
        temperature: opts.temperature ?? (opts.json ? 0.2 : 0.6),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      return { ok: false, error: `The model gateway returned ${res.status}. ${detail}`.trim(), model };
    }

    const parsed = readCompletion(await res.text());
    if ('error' in parsed) return { ok: false, error: parsed.error, model };
    const { text, usage } = parsed;

    if (!opts.json) return { ok: true, text, model, usage };

    const data = parseJsonLoose(text);
    if (data === undefined) {
      return { ok: false, error: 'The model did not return parseable JSON.', text, model, usage };
    }
    return { ok: true, text, data, model, usage };
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'The model took too long to respond.'
      : err instanceof Error ? err.message : 'Request to the model gateway failed.';
    return { ok: false, error: message, model };
  } finally {
    clearTimeout(timer);
  }
}
