/**
 * Market data adapters.
 *
 * Two providers, both free-tier, chosen to fit what those tiers actually allow:
 *
 *   Finnhub  — live quotes and the news wire. Its /stock/candle and
 *              /calendar/economic endpoints are paid-only, so nothing here
 *              depends on them.
 *   FRED     — daily history for rates, indices, spreads and macro series.
 *              This is what draws the charts, since Finnhub cannot.
 *
 * Both are proxied server-side: the browser cannot call them directly (no CORS
 * on FRED) and the keys must stay out of the bundle.
 */

const FINNHUB = 'https://finnhub.io/api/v1';
const FRED = 'https://api.stlouisfed.org/fred';
const TIMEOUT_MS = 12_000;

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface Series {
  id: string;
  label: string;
  points: SeriesPoint[];
  latest?: SeriesPoint;
  /** Change vs the previous available observation. */
  change?: number;
}

export interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image?: string;
  related?: string;
}

export interface MarketResponse {
  ok: boolean;
  error?: string;
  quotes?: Quote[];
  series?: Series[];
  news?: NewsItem[];
  /** Which providers were reachable, so the UI can explain a partial page. */
  providers?: { finnhub: boolean; fred: boolean };
}

/**
 * The cross-asset dashboard, as FRED series ids. Chosen so one request covers
 * rates, curve shape, equities, vol, credit, dollar, oil and inflation
 * expectations.
 */
export const FRED_SERIES: Record<string, string> = {
  DGS2: '2Y Treasury',
  DGS10: '10Y Treasury',
  DGS30: '30Y Treasury',
  T10Y2Y: '2s10s spread',
  T10YIE: '10Y breakeven inflation',
  SP500: 'S&P 500',
  VIXCLS: 'VIX',
  DTWEXBGS: 'Dollar index (broad)',
  DCOILWTICO: 'WTI crude',
  BAMLH0A0HYM2: 'US high-yield OAS',
  FEDFUNDS: 'Fed funds rate',
  UNRATE: 'Unemployment rate',
  CPIAUCSL: 'CPI (index)',
};

/** Tenors for the yield-curve chart, shortest to longest. */
export const CURVE_SERIES: { id: string; months: number; label: string }[] = [
  { id: 'DGS1MO', months: 1, label: '1M' },
  { id: 'DGS3MO', months: 3, label: '3M' },
  { id: 'DGS6MO', months: 6, label: '6M' },
  { id: 'DGS1', months: 12, label: '1Y' },
  { id: 'DGS2', months: 24, label: '2Y' },
  { id: 'DGS5', months: 60, label: '5Y' },
  { id: 'DGS7', months: 84, label: '7Y' },
  { id: 'DGS10', months: 120, label: '10Y' },
  { id: 'DGS20', months: 240, label: '20Y' },
  { id: 'DGS30', months: 360, label: '30Y' },
];

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function hasFinnhub(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export function hasFred(): boolean {
  return Boolean(process.env.FRED_API_KEY);
}

// ------------------------------------------------------------------ quotes

/** One request per symbol — Finnhub's free tier has no batch quote endpoint. */
export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];

  const results = await Promise.all(
    symbols.slice(0, 25).map(async (symbol): Promise<Quote | null> => {
      try {
        const raw = (await getJson(
          `${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
        )) as { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number };
        // Finnhub answers 200 with zeroes for an unknown symbol rather than 404.
        if (!raw.c) return null;
        return {
          symbol,
          price: raw.c,
          change: raw.d ?? 0,
          changePct: raw.dp ?? 0,
          high: raw.h ?? 0,
          low: raw.l ?? 0,
          open: raw.o ?? 0,
          prevClose: raw.pc ?? 0,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((q): q is Quote => q !== null);
}

// ------------------------------------------------------------------ series

export async function fetchSeries(ids: string[], limit = 260): Promise<Series[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];

  const results = await Promise.all(
    ids.slice(0, 20).map(async (id): Promise<Series | null> => {
      try {
        const raw = (await getJson(
          `${FRED}/series/observations?series_id=${encodeURIComponent(id)}` +
            `&file_type=json&sort_order=desc&limit=${limit}&api_key=${key}`
        )) as { observations?: { date: string; value: string }[] };

        // FRED marks missing observations with "." — dropping them keeps the
        // charts from showing phantom zeroes on holidays.
        const points = (raw.observations ?? [])
          .map((o) => ({ date: o.date, value: Number(o.value) }))
          .filter((p) => Number.isFinite(p.value))
          .reverse();

        if (points.length === 0) return null;
        const latest = points[points.length - 1];
        const prev = points[points.length - 2];
        return {
          id,
          label: FRED_SERIES[id] ?? CURVE_SERIES.find((c) => c.id === id)?.label ?? id,
          points,
          latest,
          change: prev ? latest.value - prev.value : undefined,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((s): s is Series => s !== null);
}

// -------------------------------------------------------------------- news

export async function fetchNews(category = 'general'): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const raw = (await getJson(
      `${FINNHUB}/news?category=${encodeURIComponent(category)}&token=${key}`
    )) as NewsItem[];
    return (Array.isArray(raw) ? raw : []).slice(0, 30);
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------- routing

export interface MarketRequest {
  op: string;
  symbols: string[];
  series: string[];
  category: string;
}

export function requestFromQuery(query: Record<string, string | string[] | undefined>): MarketRequest {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const list = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v.join(',') : v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    op: one(query.op) || 'dashboard',
    symbols: list(query.symbols),
    series: list(query.series),
    category: one(query.category) || 'general',
  };
}

export async function handleMarket(req: MarketRequest): Promise<MarketResponse> {
  const providers = { finnhub: hasFinnhub(), fred: hasFred() };
  if (!providers.finnhub && !providers.fred) {
    return {
      ok: false,
      error: 'No market data keys configured (FINNHUB_API_KEY / FRED_API_KEY).',
      providers,
    };
  }

  switch (req.op) {
    case 'quotes':
      return { ok: true, quotes: await fetchQuotes(req.symbols), providers };

    case 'series':
      return {
        ok: true,
        series: await fetchSeries(req.series.length ? req.series : Object.keys(FRED_SERIES)),
        providers,
      };

    case 'curve':
      return { ok: true, series: await fetchSeries(CURVE_SERIES.map((c) => c.id), 2), providers };

    case 'news':
      return { ok: true, news: await fetchNews(req.category), providers };

    case 'dashboard': {
      // One round trip for the page's initial paint.
      const [quotes, series, news] = await Promise.all([
        req.symbols.length ? fetchQuotes(req.symbols) : Promise.resolve([]),
        fetchSeries(Object.keys(FRED_SERIES)),
        fetchNews(req.category),
      ]);
      return { ok: true, quotes, series, news, providers };
    }

    default:
      return { ok: false, error: `Unknown op: ${req.op}`, providers };
  }
}
