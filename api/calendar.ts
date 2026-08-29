import { fetchCalendars, requestFromQuery } from '../src/lib/icsProxy.ts';

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

/**
 * GET /api/calendar?url=<ical url>&url=<another>&from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<offset min>
 *
 * Accepts several `url` params (one per subscribed calendar) and returns both a
 * merged event list and the per-feed status, so one broken feed is reported
 * without losing the others. Deployed by Vercel from the /api directory.
 */
export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const result = await fetchCalendars(requestFromQuery(req.query ?? {}));
  res.status(result.ok ? 200 : 400).json(result);
}
