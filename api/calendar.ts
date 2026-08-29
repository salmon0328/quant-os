import { fetchCalendar, requestFromQuery } from '../src/lib/icsProxy.ts';

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
 * GET /api/calendar?url=<secret ical url>&from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<offset min>
 *
 * Deployed by Vercel automatically from the /api directory.
 */
export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const result = await fetchCalendar(requestFromQuery(req.query ?? {}));
  res.status(result.ok ? 200 : 400).json(result);
}
