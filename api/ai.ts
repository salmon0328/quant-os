// Vercel only compiles files under api/, so the shared implementation lives in
// api/_lib (underscore-prefixed files are dependencies, not routes) and the
// specifier carries a .js extension — see the note in api/calendar.ts.
import { aiStatus, handleAi } from './_lib/aiHandler.js';

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(body: unknown): VercelLikeResponse;
  end(): void;
  setHeader(name: string, value: string): void;
}

function header(req: VercelLikeRequest, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * POST /api/ai  { task, payload }
 *
 * `task` must be one of the names in api/_lib/prompts.ts; the prompt itself is
 * built server-side from `payload`. Requires a Supabase access token in the
 * Authorization header.
 */
export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  // Same-origin only: this route spends money, so it must not be callable from
  // another site's page using a visitor's session.
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  // GET is the status probe: no auth, no model call, no secrets in the reply.
  if (req.method === 'GET') {
    res.status(200).json(aiStatus());
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use GET for status or POST to run a task.' });
    return;
  }

  // Vercel parses JSON bodies for us; tolerate a raw string just in case.
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ ok: false, error: 'Body must be JSON.' });
      return;
    }
  }

  const result = await handleAi(body, header(req, 'authorization'), { requireAuth: true });
  res.status(result.status).json(result.body);
}
