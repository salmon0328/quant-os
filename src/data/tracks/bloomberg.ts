/* eslint-disable */
// A Bloomberg terminal curriculum: one function per session, in an order where
// each builds on the last.
//
// The old planner said "learn one function properly" and linked to Bloomberg's
// product marketing page — it named no function and remembered nothing. This
// catalogue names the mnemonic, says what it shows, and gives three concrete
// steps to run, so a session has a definite start and a definite output.
//
// Ids must stay stable: trackProgress.completedIds references them.

export type TerminalCategory = 'orientation' | 'equity' | 'macro' | 'rates' | 'vol' | 'portfolio' | 'programmatic';

export interface TerminalFunction {
  id: string;
  /** The mnemonic you actually type, e.g. "DES". */
  mnemonic: string;
  name: string;
  category: TerminalCategory;
  order: number;
  /** One line on what the screen is for. */
  whatItShows: string;
  /** Three concrete things to do, so the session has a real output. */
  tryThis: string[];
  /** Ids that should be learned first. */
  buildsOn?: string[];
  estMinutes: number;
}

/**
 * Written to be typed on a real terminal: every step names a ticker in
 * Bloomberg's own syntax (`AAPL US Equity`) so it can be copied verbatim.
 */
export const TERMINAL: TerminalFunction[] = [
  {
    id: 'bb-des', mnemonic: 'DES', name: 'Security Description', category: 'orientation', order: 1, estMinutes: 25,
    whatItShows: 'The one-screen summary of any security: what it is, who issues it, and the headline numbers.',
    tryThis: [
      'Type `AAPL US Equity DES <GO>`. Write down the GICS sector, shares outstanding and free float.',
      'Do the same for `TSLA US Equity` and note which single field differs most between the two.',
      'Now run `DES` on a bond (`T 4 ⅜ 05/15/34 Govt`) and list three fields equities do not have.',
    ],
  },
  {
    id: 'bb-n', mnemonic: 'N / CN', name: 'News and Company News', category: 'orientation', order: 2, estMinutes: 20,
    whatItShows: 'The news wire, filtered globally (N) or to one company (CN).',
    tryThis: [
      'Run `TOP <GO>` and read the three stories the terminal thinks matter most right now.',
      'Run `AAPL US Equity CN <GO>`; find the most recent story that moved the stock and note the timestamp.',
      'Compare that timestamp to the intraday chart later in `GIP` — did price move before or after the print?',
    ],
    buildsOn: ['bb-des'],
  },
  {
    id: 'bb-gp', mnemonic: 'GP', name: 'Price Graph', category: 'equity', order: 3, estMinutes: 25,
    whatItShows: 'The workhorse price chart, with overlays, studies and adjustable periodicity.',
    tryThis: [
      'Run `SPX Index GP <GO>`; set the period to 5 years and add a 200-day moving average.',
      'Overlay `VIX Index` on the same chart and describe the relationship in one sentence.',
      'Export the underlying series to Excel and confirm the daily returns match what you compute.',
    ],
    buildsOn: ['bb-des'],
  },
  {
    id: 'bb-gip', mnemonic: 'GIP', name: 'Intraday Price Graph', category: 'equity', order: 4, estMinutes: 20,
    whatItShows: 'Tick-level and intraday bars — where you actually see a reaction to a release.',
    tryThis: [
      'Run `SPX Index GIP <GO>` at 1-minute bars for the last CPI release date.',
      'Mark the exact minute of the print and measure the range in the following five minutes.',
      'Write one line: did the move persist to the close, or mean-revert?',
    ],
    buildsOn: ['bb-gp'],
  },
  {
    id: 'bb-hp', mnemonic: 'HP', name: 'Historical Price Table', category: 'equity', order: 5, estMinutes: 20,
    whatItShows: 'The raw historical price table — the honest source behind every chart.',
    tryThis: [
      'Run `AAPL US Equity HP <GO>` for the last 250 trading days.',
      'Export to Excel and compute annualised realised volatility from the daily log returns.',
      'Compare your number to the terminal’s own realised vol field and reconcile any difference.',
    ],
    buildsOn: ['bb-gp'],
  },
  {
    id: 'bb-fa', mnemonic: 'FA', name: 'Financial Analysis', category: 'equity', order: 6, estMinutes: 35,
    whatItShows: 'Full financial statements, ratios and segment detail, standardised across companies.',
    tryThis: [
      'Run `AAPL US Equity FA <GO>`; pull five years of revenue, gross margin and FCF.',
      'Switch to the Segments tab and write down the revenue mix — this is what `DES` cannot tell you.',
      'Repeat for one competitor and note the single biggest structural difference.',
    ],
    buildsOn: ['bb-des'],
  },
  {
    id: 'bb-ee', mnemonic: 'EE', name: 'Earnings Estimates', category: 'equity', order: 7, estMinutes: 25,
    whatItShows: 'Consensus estimates and the history of beats and misses — the bar a company is judged against.',
    tryThis: [
      'Run `AAPL US Equity EE <GO>`; record consensus EPS and revenue for the next quarter.',
      'Look at the last eight quarters: how often did they beat, and by how much on average?',
      'Note the dispersion across analysts — wide dispersion is where the interesting trades live.',
    ],
    buildsOn: ['bb-fa'],
  },
  {
    id: 'bb-rv', mnemonic: 'RV', name: 'Relative Valuation', category: 'equity', order: 8, estMinutes: 30,
    whatItShows: 'A company against its peer group on every multiple at once.',
    tryThis: [
      'Run `AAPL US Equity RV <GO>` and inspect the default peer set — decide whether you agree with it.',
      'Rank the peers by EV/EBITDA and by P/E; note where the ordering disagrees and why.',
      'Write one sentence defending a peer you would remove from the set.',
    ],
    buildsOn: ['bb-fa', 'bb-ee'],
  },
  {
    id: 'bb-eqs', mnemonic: 'EQS', name: 'Equity Screening', category: 'equity', order: 9, estMinutes: 35,
    whatItShows: 'Screen the entire global equity universe on any combination of fields.',
    tryThis: [
      'Build a screen: US listed, market cap > $2bn, FCF yield > 5%, net debt/EBITDA < 2x.',
      'Save the screen, then note how many names survive and how that count changes if you drop one criterion.',
      'Export the list — this is the raw universe for the factor project in Projects.',
    ],
    buildsOn: ['bb-fa'],
  },
  {
    id: 'bb-wei', mnemonic: 'WEI', name: 'World Equity Indices', category: 'macro', order: 10, estMinutes: 20,
    whatItShows: 'Every major equity index on one screen — the fastest read on a global session.',
    tryThis: [
      'Run `WEI <GO>` and write down the three best and three worst performing markets today.',
      'Identify whether the dispersion is regional, sector-driven, or currency-driven.',
      'Turn that into one Market Journal entry with a causal chain.',
    ],
  },
  {
    id: 'bb-eco', mnemonic: 'ECO', name: 'Economic Calendar', category: 'macro', order: 11, estMinutes: 25,
    whatItShows: 'Scheduled data releases with consensus, prior and actual — and the surprise.',
    tryThis: [
      'Run `ECO <GO>` for the United States this week; note every release with a high relevance score.',
      'For the last CPI print, record consensus vs actual and the surprise in standard deviations.',
      'Cross-check the market reaction in `GIP` at that exact minute.',
    ],
    buildsOn: ['bb-gip'],
  },
  {
    id: 'bb-btmm', mnemonic: 'BTMM', name: 'Treasury and Money Markets Monitor', category: 'macro', order: 12, estMinutes: 25,
    whatItShows: 'The US rates complex on one screen: bills, notes, futures, repo and policy rates.',
    tryThis: [
      'Run `BTMM <GO>` and write down the current effective fed funds rate and SOFR.',
      'Note the 2y, 10y and 30y yields and compute 2s10s yourself.',
      'Say in one line what the curve shape currently implies about growth expectations.',
    ],
  },
  {
    id: 'bb-wirp', mnemonic: 'WIRP', name: 'World Interest Rate Probability', category: 'macro', order: 13, estMinutes: 30,
    whatItShows: 'Market-implied probabilities of central bank moves, derived from OIS pricing.',
    tryThis: [
      'Run `WIRP <GO>` for the Fed; record the implied probability of a move at the next two meetings.',
      'Note the number of cuts/hikes priced over the next 12 months.',
      'Check how those probabilities shifted after the most recent CPI print — that shift is the trade.',
    ],
    buildsOn: ['bb-eco', 'bb-btmm'],
  },
  {
    id: 'bb-yas', mnemonic: 'YAS', name: 'Yield and Spread Analysis', category: 'rates', order: 14, estMinutes: 35,
    whatItShows: 'Price/yield, spread to benchmark, duration and convexity for a single bond.',
    tryThis: [
      'Run `YAS` on a 10-year Treasury; record yield, modified duration and DV01.',
      'Shift the yield by 25bp and check the predicted price change against duration × 25bp.',
      'Explain the residual — that gap is convexity, and being able to name it is the point.',
    ],
    buildsOn: ['bb-btmm'],
  },
  {
    id: 'bb-crvf', mnemonic: 'CRVF', name: 'Curve Finder', category: 'rates', order: 15, estMinutes: 25,
    whatItShows: 'Every yield curve Bloomberg builds — govvies, swaps, credit — searchable.',
    tryThis: [
      'Find and plot the US Treasury actives curve and the USD swap curve on the same axes.',
      'Read off the 10-year swap spread and note its sign.',
      'Write one line on what a negative swap spread implies about balance-sheet costs.',
    ],
    buildsOn: ['bb-yas'],
  },
  {
    id: 'bb-fwcv', mnemonic: 'FWCV', name: 'Forward Curve Analysis', category: 'rates', order: 16, estMinutes: 30,
    whatItShows: 'Forward curves implied by today’s spot curve — what the market has already priced.',
    tryThis: [
      'Plot the current curve against the 1y-forward and 2y-forward curves.',
      'Identify the horizon at which the forwards imply cuts.',
      'Compare that to the `WIRP` probabilities — if they disagree, work out which one you believe.',
    ],
    buildsOn: ['bb-crvf', 'bb-wirp'],
  },
  {
    id: 'bb-swpm', mnemonic: 'SWPM', name: 'Swap Manager', category: 'rates', order: 17, estMinutes: 40,
    whatItShows: 'Builds and prices interest rate swaps, with full cashflow and risk breakdown.',
    tryThis: [
      'Build a 5-year USD fixed-for-floating swap at par; record the par rate.',
      'Inspect the cashflow schedule and confirm the fixed leg PV equals the floating leg PV at inception.',
      'Bump the curve 1bp and record the DV01 — check it against the sum of the per-tenor bucket risks.',
    ],
    buildsOn: ['bb-crvf'],
  },
  {
    id: 'bb-omon', mnemonic: 'OMON', name: 'Option Monitor', category: 'vol', order: 18, estMinutes: 30,
    whatItShows: 'The full option chain for a name: strikes, expiries, greeks, volume and open interest.',
    tryThis: [
      'Run `AAPL US Equity OMON <GO>`; find the at-the-money straddle for the front expiry.',
      'Compute the implied move from the straddle price and compare it to the earnings date in `EE`.',
      'Note where open interest clusters — and what that says about positioning.',
    ],
    buildsOn: ['bb-des', 'bb-ee'],
  },
  {
    id: 'bb-hivg', mnemonic: 'HIVG', name: 'Historical Implied vs Realised Vol', category: 'vol', order: 19, estMinutes: 30,
    whatItShows: 'Implied volatility against subsequently realised volatility, through time.',
    tryThis: [
      'Run `HIVG` on `AAPL US Equity` for two years of 30-day implied vs 30-day realised.',
      'Measure the average variance risk premium — how much richer is implied, on average?',
      'Find the two largest episodes where realised exceeded implied and identify what happened.',
    ],
    buildsOn: ['bb-omon', 'bb-hp'],
  },
  {
    id: 'bb-ovdv', mnemonic: 'OVDV', name: 'Volatility Surface', category: 'vol', order: 20, estMinutes: 35,
    whatItShows: 'The implied volatility surface across strike and expiry.',
    tryThis: [
      'Pull the surface for `SPX Index`; describe the skew at the 1-month expiry in one sentence.',
      'Compare the 1-month and 1-year skew — note which is steeper and say why.',
      'Contrast with a single-stock surface: index skew is steeper, and you should be able to explain that.',
    ],
    buildsOn: ['bb-omon'],
  },
  {
    id: 'bb-skew', mnemonic: 'SKEW', name: 'Skew Analysis', category: 'vol', order: 21, estMinutes: 30,
    whatItShows: 'Skew through time — risk reversals and put/call implied vol spreads.',
    tryThis: [
      'Plot 25-delta risk reversal for `SPX Index` over three years.',
      'Mark the percentile the current level sits at.',
      'Write one line linking the current skew to the positioning story you saw in `OMON`.',
    ],
    buildsOn: ['bb-ovdv'],
  },
  {
    id: 'bb-port', mnemonic: 'PORT', name: 'Portfolio and Risk Analytics', category: 'portfolio', order: 22, estMinutes: 40,
    whatItShows: 'Attribution, factor exposures and risk decomposition for a portfolio.',
    tryThis: [
      'Load the `EQS` screen you saved as an equal-weighted portfolio.',
      'Run the factor exposure view — record the momentum, value and size loadings.',
      'Run attribution over the last year and note whether returns came from selection or allocation.',
    ],
    buildsOn: ['bb-eqs'],
  },
  {
    id: 'bb-hra', mnemonic: 'HRA', name: 'Historical Regression Analysis', category: 'portfolio', order: 23, estMinutes: 30,
    whatItShows: 'Regresses one security on another — beta, correlation and residuals.',
    tryThis: [
      'Regress `AAPL US Equity` on `SPX Index` over two years; record beta and R².',
      'Re-run over six months and note how unstable beta is — this is the point of the exercise.',
      'Write one line on what that instability means for a hedge ratio you would actually trade.',
    ],
    buildsOn: ['bb-port'],
  },
  {
    id: 'bb-bqnt', mnemonic: 'BQNT', name: 'BQuant', category: 'programmatic', order: 24, estMinutes: 45,
    whatItShows: 'A Python environment inside the terminal, with direct access to Bloomberg data.',
    tryThis: [
      'Open `BQNT <GO>` and pull five years of daily closes for a small universe with `bql`.',
      'Reproduce the realised-vol calculation you did by hand in `HP`, now in code.',
      'Save the notebook — this is the bridge between the terminal and your own projects.',
    ],
    buildsOn: ['bb-hp', 'bb-eqs'],
  },
];

export const TERMINAL_BY_ID = new Map(TERMINAL.map((f) => [f.id, f]));
