import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchCalendars, requestFromQuery } from './api/_lib/icsProxy';
import { aiStatus, handleAi } from './api/_lib/aiHandler';
import { handleMarket, requestFromQuery as marketQuery } from './api/_lib/marketProviders';

interface DevResponse {
  statusCode: number;
  setHeader(key: string, value: string): void;
  end(body: string): void;
}

interface DevRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: string, cb: (chunk?: unknown) => void): void;
}

type DevHandler = (req: DevRequest, res: DevResponse) => Promise<void>;

function send(res: DevResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Repeated params must survive: the serverless route receives them as arrays. */
function queryOf(reqUrl: string): Record<string, string | string[]> {
  const parsed = new URL(reqUrl, 'http://localhost');
  const query: Record<string, string | string[]> = {};
  parsed.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  return query;
}

function readBody(req: DevRequest): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
  });
}

/**
 * Mirrors the Vercel /api functions during `npm run dev` so the integrations
 * behave identically locally and in production. Each handler delegates to the
 * same api/_lib module the deployed route uses.
 */
function apiPlugin(): Plugin {
  const routes: Record<string, DevHandler> = {
    '/api/calendar': async (req, res) => {
      const result = await fetchCalendars(requestFromQuery(queryOf(req.url ?? '')));
      send(res, result.ok ? 200 : 400, result);
    },
    '/api/market': async (req, res) => {
      const result = await handleMarket(marketQuery(queryOf(req.url ?? '')));
      send(res, result.ok ? 200 : 400, result);
    },
    '/api/ai': async (req, res) => {
      if (req.method === 'GET') return send(res, 200, aiStatus());
      if (req.method !== 'POST') {
        return send(res, 405, { ok: false, error: 'Use GET for status or POST to run a task.' });
      }
      // requireAuth is false here only because the dev server is bound to
      // localhost. The deployed route always verifies the caller.
      const result = await handleAi(await readBody(req), undefined, { requireAuth: false });
      send(res, result.status, result.body);
    },
  };

  return {
    name: 'quant-os-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        const handler = path ? routes[path] : undefined;
        if (!handler) return next();
        void handler(req as unknown as DevRequest, res as unknown as DevResponse);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-side secrets (OPENROUTER_API_KEY, FINNHUB_API_KEY…) are deliberately
  // unprefixed, so Vite does not expose them to the client bundle and does not
  // load them into process.env either. The dev middleware runs in this Node
  // process, so load them explicitly — the '' prefix means "every key".
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return { plugins: [react(), apiPlugin()] };
});
