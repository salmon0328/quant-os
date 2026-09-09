/**
 * Default tape symbols.
 *
 * ETFs rather than index tickers, because the free Finnhub tier quotes US
 * equities and ETFs but not index symbols like ^GSPC — SPY tracks what you
 * actually want to see and resolves reliably.
 */
export const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'TLT', 'HYG', 'UUP', 'GLD', 'USO'];

export const WATCHLIST_HINT: Record<string, string> = {
  SPY: 'S&P 500', QQQ: 'Nasdaq 100', TLT: '20Y+ Treasuries', HYG: 'High yield credit',
  UUP: 'US dollar', GLD: 'Gold', USO: 'WTI crude',
};
