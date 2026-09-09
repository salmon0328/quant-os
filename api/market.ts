// See the note in api/calendar.ts about .js specifiers under api/.
import { handleMarket, requestFromQuery } from './_lib/marketProviders.js';

interface VercelLikeRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(body: unknown): VercelLikeResponse;
  end(): void;
  setHeader(name: string, value: string): void;
}

/** Cache windows per op — quotes move, macro series do not. */
const CACHE: Record<string, number> = {
  quotes: 60,
  news: 300,
  series: 21_600,
  curve: 21_600,
  dashboard: 300,
};

/**
 * GET /api/market?op=dashboard|quotes|series|curve|news&symbols=…&series=…
 *
 * Proxies Finnhub (quotes, news) and FRED (history). Both keys are server-side
 * only; FRED additionally sends no CORS headers, so this cannot be done from
 * the browser.
 */
export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const request = requestFromQuery(req.query ?? {});
  const maxAge = CACHE[request.op] ?? 300;
  res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);

  const result = await handleMarket(request);
  res.status(result.ok ? 200 : 400).json(result);
}
