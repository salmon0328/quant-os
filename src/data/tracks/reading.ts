/* eslint-disable */
// Chapter-level reading units for the core technical books.
//
// The planner had no reading task at all: derivatives lived in a resource list
// as a link to Hull's homepage. This turns the books into a queue the planner
// can walk, one chapter at a time, naming the chapter and its concepts.
//
// `bookId` is shared with the Books page, so ticking a reading task ticks the
// chapter on the shelf. Ids must stay stable — trackProgress references them.
//
// Chapter numbers are per the edition noted on each book; if your copy differs,
// the title is the thing to trust.

export interface ReadingUnit {
  id: string;
  bookId: string;
  bookLabel: string;
  chapter: number;
  title: string;
  /** What this chapter is actually teaching — shown on the task. */
  concepts: string[];
  estMinutes: number;
  order: number;
}

export const READING: ReadingUnit[] = [
  { id: "rd-hull-1", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 1, title: "Introduction", concepts: ["derivatives markets", "hedgers vs speculators vs arbitrageurs"], estMinutes: 35, order: 1 },
  { id: "rd-hull-2", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 2, title: "Futures Markets and Central Counterparties", concepts: ["margin", "marking to market", "clearing"], estMinutes: 40, order: 2 },
  { id: "rd-hull-3", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 3, title: "Hedging Strategies Using Futures", concepts: ["minimum variance hedge ratio", "basis risk"], estMinutes: 45, order: 3 },
  { id: "rd-hull-4", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 4, title: "Interest Rates", concepts: ["compounding", "zero rates", "bootstrapping", "duration"], estMinutes: 50, order: 4 },
  { id: "rd-hull-5", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 5, title: "Determination of Forward and Futures Prices", concepts: ["cost of carry", "no-arbitrage bounds"], estMinutes: 45, order: 5 },
  { id: "rd-hull-6", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 6, title: "Interest Rate Futures", concepts: ["day counts", "Treasury bond futures", "cheapest to deliver"], estMinutes: 45, order: 6 },
  { id: "rd-hull-7", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 7, title: "Swaps", concepts: ["fixed for floating", "swap valuation", "comparative advantage"], estMinutes: 50, order: 7 },
  { id: "rd-hull-8", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 8, title: "Securitization and the Credit Crisis of 2007", concepts: ["tranching", "ABS CDOs"], estMinutes: 30, order: 8 },
  { id: "rd-hull-9", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 9, title: "XVAs", concepts: ["CVA", "DVA", "FVA"], estMinutes: 30, order: 9 },
  { id: "rd-hull-10", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 10, title: "Mechanics of Options Markets", concepts: ["contract specs", "margin", "market makers"], estMinutes: 35, order: 10 },
  { id: "rd-hull-11", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 11, title: "Properties of Stock Options", concepts: ["put-call parity", "early exercise bounds"], estMinutes: 50, order: 11 },
  { id: "rd-hull-12", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 12, title: "Trading Strategies Involving Options", concepts: ["spreads", "straddles", "butterflies"], estMinutes: 45, order: 12 },
  { id: "rd-hull-13", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 13, title: "Binomial Trees", concepts: ["risk-neutral valuation", "replication", "backward induction"], estMinutes: 60, order: 13 },
  { id: "rd-hull-14", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 14, title: "Wiener Processes and Ito's Lemma", concepts: ["Brownian motion", "Ito's lemma", "GBM"], estMinutes: 60, order: 14 },
  { id: "rd-hull-15", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 15, title: "The Black-Scholes-Merton Model", concepts: ["BSM PDE", "risk-neutral measure", "implied vol"], estMinutes: 70, order: 15 },
  { id: "rd-hull-16", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 16, title: "Employee Stock Options", concepts: ["dilution", "valuation issues"], estMinutes: 20, order: 16 },
  { id: "rd-hull-17", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 17, title: "Options on Stock Indices and Currencies", concepts: ["dividend yield adjustment", "Garman-Kohlhagen"], estMinutes: 35, order: 17 },
  { id: "rd-hull-18", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 18, title: "Futures Options and Black's Model", concepts: ["Black's model", "futures vs spot options"], estMinutes: 35, order: 18 },
  { id: "rd-hull-19", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 19, title: "The Greek Letters", concepts: ["delta", "gamma", "vega", "theta", "rho", "delta hedging"], estMinutes: 70, order: 19 },
  { id: "rd-hull-20", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 20, title: "Volatility Smiles and Volatility Surfaces", concepts: ["smile", "skew", "term structure"], estMinutes: 55, order: 20 },
  { id: "rd-hull-21", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 21, title: "Basic Numerical Procedures", concepts: ["trees", "Monte Carlo", "finite differences"], estMinutes: 60, order: 21 },
  { id: "rd-hull-22", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 22, title: "Value at Risk and Expected Shortfall", concepts: ["VaR", "expected shortfall", "backtesting"], estMinutes: 50, order: 22 },
  { id: "rd-hull-23", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 23, title: "Estimating Volatilities and Correlations", concepts: ["EWMA", "GARCH(1,1)", "maximum likelihood"], estMinutes: 55, order: 23 },
  { id: "rd-hull-24", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 24, title: "Credit Risk", concepts: ["default probability", "recovery rates", "Merton model"], estMinutes: 45, order: 24 },
  { id: "rd-hull-25", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 25, title: "Credit Derivatives", concepts: ["CDS", "CDS spreads", "index tranches"], estMinutes: 40, order: 25 },
  { id: "rd-hull-26", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 26, title: "Exotic Options", concepts: ["barriers", "Asians", "lookbacks", "digitals"], estMinutes: 45, order: 26 },
  { id: "rd-hull-27", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 27, title: "More on Models and Numerical Procedures", concepts: ["stochastic vol", "jump diffusion"], estMinutes: 50, order: 27 },
  { id: "rd-hull-28", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 28, title: "Martingales and Measures", concepts: ["change of numeraire", "equivalent martingale measure"], estMinutes: 60, order: 28 },
  { id: "rd-hull-29", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 29, title: "Interest Rate Derivatives: The Standard Market Models", concepts: ["caps", "floors", "swaptions"], estMinutes: 50, order: 29 },
  { id: "rd-hull-30", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 30, title: "Convexity, Timing, and Quanto Adjustments", concepts: ["convexity adjustment", "quanto"], estMinutes: 40, order: 30 },
  { id: "rd-hull-31", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 31, title: "Equilibrium Models of the Short Rate", concepts: ["Vasicek", "CIR"], estMinutes: 40, order: 31 },
  { id: "rd-hull-32", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 32, title: "No-Arbitrage Models of the Short Rate", concepts: ["Hull-White", "calibration"], estMinutes: 45, order: 32 },
  { id: "rd-hull-33", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 33, title: "Modeling Forward Rates", concepts: ["HJM", "LIBOR market model"], estMinutes: 45, order: 33 },
  { id: "rd-hull-34", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 34, title: "Swaps Revisited", concepts: ["compounding swaps", "equity swaps"], estMinutes: 30, order: 34 },
  { id: "rd-hull-35", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 35, title: "Energy and Commodity Derivatives", concepts: ["convenience yield", "seasonality"], estMinutes: 35, order: 35 },
  { id: "rd-hull-36", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 36, title: "Real Options", concepts: ["investment as an option"], estMinutes: 25, order: 36 },
  { id: "rd-hull-37", bookId: "hull", bookLabel: "Hull — Options, Futures and Other Derivatives", chapter: 37, title: "Derivatives Mishaps and What We Can Learn from Them", concepts: ["risk limits", "case studies"], estMinutes: 25, order: 37 },
  { id: "rd-natenberg-1", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 1, title: "Financial Contracts", concepts: ["forwards", "futures", "options as contracts"], estMinutes: 25, order: 38 },
  { id: "rd-natenberg-2", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 2, title: "Forward Pricing", concepts: ["cost of carry", "forward vs spot"], estMinutes: 30, order: 39 },
  { id: "rd-natenberg-3", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 3, title: "Contract Specifications and Option Terminology", concepts: ["moneyness", "exercise styles"], estMinutes: 30, order: 40 },
  { id: "rd-natenberg-4", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 4, title: "Expiration Profit and Loss", concepts: ["payoff diagrams", "breakeven"], estMinutes: 35, order: 41 },
  { id: "rd-natenberg-5", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 5, title: "Theoretical Pricing Models", concepts: ["expected value", "the pricing problem"], estMinutes: 40, order: 42 },
  { id: "rd-natenberg-6", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 6, title: "Volatility", concepts: ["realised vs implied", "lognormal returns", "vol as a number"], estMinutes: 55, order: 43 },
  { id: "rd-natenberg-7", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 7, title: "Risk Measurement I", concepts: ["delta", "gamma", "theta", "vega"], estMinutes: 55, order: 44 },
  { id: "rd-natenberg-8", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 8, title: "Dynamic Hedging", concepts: ["rehedging", "gamma scalping", "P&L of a hedged position"], estMinutes: 60, order: 45 },
  { id: "rd-natenberg-9", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 9, title: "Risk Measurement II", concepts: ["higher order greeks", "vanna", "volga"], estMinutes: 45, order: 46 },
  { id: "rd-natenberg-10", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 10, title: "Introduction to Spreading", concepts: ["why spread", "risk reduction"], estMinutes: 30, order: 47 },
  { id: "rd-natenberg-11", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 11, title: "Volatility Spreads", concepts: ["straddles", "strangles", "butterflies", "condors", "ratio spreads"], estMinutes: 55, order: 48 },
  { id: "rd-natenberg-12", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 12, title: "Bull and Bear Spreads", concepts: ["vertical spreads", "directional risk"], estMinutes: 35, order: 49 },
  { id: "rd-natenberg-13", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 13, title: "Risk Considerations", concepts: ["choosing among strategies", "practical constraints"], estMinutes: 40, order: 50 },
  { id: "rd-natenberg-14", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 14, title: "Synthetics", concepts: ["synthetic stock", "conversion", "reversal"], estMinutes: 40, order: 51 },
  { id: "rd-natenberg-15", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 15, title: "Option Arbitrage", concepts: ["boxes", "jelly rolls", "put-call parity in practice"], estMinutes: 45, order: 52 },
  { id: "rd-natenberg-16", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 16, title: "Early Exercise of American Options", concepts: ["when early exercise is optimal"], estMinutes: 35, order: 53 },
  { id: "rd-natenberg-17", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 17, title: "Hedging with Options", concepts: ["protective puts", "covered calls", "collars"], estMinutes: 40, order: 54 },
  { id: "rd-natenberg-18", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 18, title: "The Black-Scholes Model", concepts: ["assumptions", "the formula", "what it gets wrong"], estMinutes: 55, order: 55 },
  { id: "rd-natenberg-19", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 19, title: "Binomial Option Pricing", concepts: ["trees", "American options"], estMinutes: 45, order: 56 },
  { id: "rd-natenberg-20", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 20, title: "Volatility Revisited", concepts: ["forecasting vol", "vol cones"], estMinutes: 50, order: 57 },
  { id: "rd-natenberg-21", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 21, title: "Position Analysis", concepts: ["aggregate greeks", "scenario analysis"], estMinutes: 45, order: 58 },
  { id: "rd-natenberg-22", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 22, title: "Stock Index Futures and Options", concepts: ["index arbitrage", "basis"], estMinutes: 35, order: 59 },
  { id: "rd-natenberg-23", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 23, title: "Models and the Real World", concepts: ["model risk", "violated assumptions"], estMinutes: 45, order: 60 },
  { id: "rd-natenberg-24", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 24, title: "Volatility Skews", concepts: ["why skew exists", "sticky strike vs sticky delta"], estMinutes: 55, order: 61 },
  { id: "rd-natenberg-25", bookId: "natenberg", bookLabel: "Natenberg — Option Volatility and Pricing", chapter: 25, title: "Volatility Contracts", concepts: ["variance swaps", "VIX"], estMinutes: 45, order: 62 },
  { id: "rd-taleb-1", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 1, title: "Introduction to the Market", concepts: ["market making", "the trader's problem"], estMinutes: 30, order: 63 },
  { id: "rd-taleb-2", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 2, title: "The Generalized Option", concepts: ["what an option really is"], estMinutes: 35, order: 64 },
  { id: "rd-taleb-3", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 3, title: "Static Hedging and Put-Call Parity", concepts: ["static replication"], estMinutes: 40, order: 65 },
  { id: "rd-taleb-4", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 4, title: "Dynamic Hedging", concepts: ["hedging error", "discrete rehedging"], estMinutes: 55, order: 66 },
  { id: "rd-taleb-5", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 5, title: "Adjusting for Discrete Hedging", concepts: ["gamma P&L", "transaction costs"], estMinutes: 55, order: 67 },
  { id: "rd-taleb-6", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 6, title: "Volatility and Correlation", concepts: ["vol of vol", "correlation risk"], estMinutes: 50, order: 68 },
  { id: "rd-taleb-7", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 7, title: "Vega and the Volatility Surface", concepts: ["vega bucketing", "surface risk"], estMinutes: 55, order: 69 },
  { id: "rd-taleb-8", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 8, title: "Theta and Minor Greeks", concepts: ["decay", "carry"], estMinutes: 40, order: 70 },
  { id: "rd-taleb-9", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 9, title: "Gamma and Shadow Gamma", concepts: ["shadow greeks", "non-local risk"], estMinutes: 55, order: 71 },
  { id: "rd-taleb-10", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 10, title: "Skew and Smile Trading", concepts: ["risk reversals", "skew P&L"], estMinutes: 55, order: 72 },
  { id: "rd-taleb-11", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 11, title: "Exotic Options and Path Dependence", concepts: ["barriers", "pin risk"], estMinutes: 55, order: 73 },
  { id: "rd-taleb-12", bookId: "taleb", bookLabel: "Taleb — Dynamic Hedging", chapter: 12, title: "Fat Tails and Model Failure", concepts: ["tail risk", "the limits of hedging"], estMinutes: 50, order: 74 },
];

export const READING_BY_BOOK = READING.reduce<Record<string, ReadingUnit[]>>((acc, u) => {
  (acc[u.bookId] ??= []).push(u);
  return acc;
}, {});
