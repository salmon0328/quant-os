/**
 * OpenRouter client — the single place the app talks to a language model.
 *
 * OpenRouter is OpenAI-compatible, so this is a thin wrapper over one
 * chat/completions call. It lives under api/_lib because OPENROUTER_API_KEY is
 * a server secret: it must never reach the browser bundle.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const FETCH_TIMEOUT_MS = 45_000;

/** Hard ceiling regardless of what a caller asks for — a runaway loop is expensive. */
const MAX_OUTPUT_TOKENS = 2_000;

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
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function modelFor(opts: ChatOptions): string {
  if (opts.model) return opts.model;
  return opts.tier === 'smart'
    ? process.env.OPENROUTER_MODEL_SMART || 'anthropic/claude-sonnet-5'
    : process.env.OPENROUTER_MODEL_FAST || 'anthropic/claude-haiku-4.5';
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

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: 'AI is not configured (OPENROUTER_API_KEY is unset).' };

  const model = modelFor(opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // OpenRouter uses these for its dashboard attribution; both optional.
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://quant-os.local',
        'X-Title': 'Quant-OS',
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: Math.min(opts.maxTokens ?? 1_000, MAX_OUTPUT_TOKENS),
        temperature: opts.temperature ?? (opts.json ? 0.2 : 0.6),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      return { ok: false, error: `OpenRouter returned ${res.status}. ${detail}`.trim(), model };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };

    if (body.error) return { ok: false, error: body.error.message ?? 'Unknown OpenRouter error.', model };

    const text = body.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'The model returned an empty response.', model };

    const usage = {
      prompt: body.usage?.prompt_tokens ?? 0,
      completion: body.usage?.completion_tokens ?? 0,
    };

    if (!opts.json) return { ok: true, text, model, usage };

    const data = parseJsonLoose(text);
    if (data === undefined) {
      return { ok: false, error: 'The model did not return parseable JSON.', text, model, usage };
    }
    return { ok: true, text, data, model, usage };
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'The model took too long to respond.'
      : err instanceof Error ? err.message : 'Request to OpenRouter failed.';
    return { ok: false, error: message, model };
  } finally {
    clearTimeout(timer);
  }
}
