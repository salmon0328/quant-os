/**
 * Browser client for /api/market.
 *
 * Like the AI client, every caller must tolerate this being unavailable: with
 * no provider keys the market page still renders its framework and journal,
 * which is what it did before live data existed.
 */

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

export interface SeriesPoint { date: string; value: number }

export interface Series {
  id: string;
  label: string;
  points: SeriesPoint[];
  latest?: SeriesPoint;
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
  providers?: { finnhub: boolean; fred: boolean };
}

/** Tenor order for the curve chart — FRED ids are not self-sorting. */
export const CURVE_ORDER = ['DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30'];
export const CURVE_LABEL: Record<string, string> = {
  DGS1MO: '1M', DGS3MO: '3M', DGS6MO: '6M', DGS1: '1Y', DGS2: '2Y',
  DGS5: '5Y', DGS7: '7Y', DGS10: '10Y', DGS20: '20Y', DGS30: '30Y',
};

async function get(params: Record<string, string>): Promise<MarketResponse> {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`/api/market?${qs}`);
    return (await res.json()) as MarketResponse;
  } catch {
    return { ok: false, error: 'Could not reach the market data service.' };
  }
}

export const fetchDashboard = (symbols: string[]) =>
  get({ op: 'dashboard', symbols: symbols.join(',') });

export const fetchQuotes = (symbols: string[]) => get({ op: 'quotes', symbols: symbols.join(',') });
export const fetchCurve = () => get({ op: 'curve' });
export const fetchNews = (category = 'general') => get({ op: 'news', category });

/** Series the tape shows as headline numbers, in display order. */
export const TAPE_SERIES = ['SP500', 'VIXCLS', 'DGS10', 'T10Y2Y', 'DTWEXBGS', 'DCOILWTICO'];

/** Series that are percentages rather than levels — affects formatting. */
const PERCENT_SERIES = new Set(['DGS2', 'DGS10', 'DGS30', 'T10Y2Y', 'T10YIE', 'FEDFUNDS', 'UNRATE', 'BAMLH0A0HYM2']);

export function formatSeriesValue(id: string, value: number): string {
  if (PERCENT_SERIES.has(id)) return `${value.toFixed(2)}%`;
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

export function isPercentSeries(id: string): boolean {
  return PERCENT_SERIES.has(id);
}
