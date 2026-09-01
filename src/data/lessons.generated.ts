// AUTO-GENERATED lesson knowledge base.
// Run `python scripts/generate_lessons.py` after dropping book/PDF text into
// scripts/book_sources/ to regenerate this file from your reading list.
// You can also hand-edit the entries below, or add lessons from the Learn tab UI.

export const LESSON_SEEDS: any[] = [
  {
    id: 'ls-put-call-parity',
    trackId: 'finance',
    title: 'Put-Call Parity',
    summary: 'The no-arbitrage link between a European call, a European put, the stock and a zero-coupon bond.',
    difficulty: 'intermediate',
    tags: ['options', 'arbitrage', 'derivatives'],
    order: 1,
    estMinutes: 12,
    elaboration:
`Put-call parity is the cornerstone relationship that MUST hold for European options on a non-dividend-paying stock, otherwise there is a risk-free arbitrage.

The identity is:

  C - P = S - K·e^(-rT)

where C is the call price, P the put price, S the spot, K the strike, r the continuously-compounded risk-free rate, and T the time to expiry.

Intuition: the left side (long call, short put) replicates a forward contract on the stock with delivery price K. The right side (long stock, short bond) is exactly that forward. Two portfolios with identical payoffs at T must have identical value today.

Why it matters:
- It lets you price a put if you know the call (and vice versa).
- It explains why American calls on non-dividend stocks are never exercised early, while American puts can be.
- Violations in the market (after accounting for dividends, borrow costs, margins) are classic arbitrage signals.

With a continuous dividend yield q the parity becomes C - P = S·e^(-qT) - K·e^(-rT).`,
    keyNotes: [
      'C - P = S - K·e^(-rT) for European options, no dividends.',
      'Long call + short put = synthetic forward at strike K.',
      'Same payoff at expiry => same value today (no arbitrage).',
      'Dividend yield q: replace S with S·e^(-qT).',
      'Useful for put pricing, early-exercise reasoning, and spotting arbitrage.',
    ],
    practice: [
      { q: 'Write put-call parity for a non-dividend-paying stock.', a: 'C - P = S - K·e^(-rT).' },
      { q: 'What position does long call + short put replicate?', a: 'A long forward contract on the stock with delivery price K.' },
      { q: 'If C=10, S=100, K=100, r=0, T=1, what is P?', a: 'P = C - S + K·e^(-rT) = 10 - 100 + 100 = 10.' },
    ],
    videos: [
      { title: 'Put-Call Parity intuitively (Investopedia / MIT)', url: 'https://www.youtube.com/results?search_query=put+call+parity', minutes: 10 },
    ],
    sources: [
      { label: 'Hull, Options Futures & Other Derivatives, ch. 10' },
      { label: 'Green book — derivatives section' },
    ],
  },
  {
    id: 'ls-black-scholes',
    trackId: 'finance',
    title: 'Black-Scholes Intuition',
    summary: 'Why the BS formula prices a European call as discounted expected payoff under the risk-neutral measure.',
    difficulty: 'advanced',
    tags: ['options', 'black-scholes', 'greeks'],
    order: 2,
    estMinutes: 18,
    elaboration:
`The Black-Scholes-Merton price for a European call is:

  C = S·N(d1) - K·e^(-rT)·N(d2)
  d1 = [ln(S/K) + (r + σ²/2)T] / (σ·√T)
  d2 = d1 - σ·√T

Key intuitions (not just the formula):
- The formula is the discounted EXPECTED payoff under the RISK-NEUTRAL measure, where the drift of the stock is the risk-free rate r, not the real expected return.
- N(d1) is the delta — the hedge ratio / probability the option finishes in the money under a measure adjusted for the stock numéraire.
- N(d2) is the risk-neutral probability the option expires in the money.
- Volatility σ enters everywhere; the model is really a volatility pricing engine. That is why implied vol (inverting the formula for σ) is the tradable quantity.
- Assumptions: no dividends, constant vol & rates, lognormal returns, continuous trading, no transaction costs, European exercise. Real markets violate all of these, which is why the vol smile exists.

Greeks to remember: Delta = N(d1); Vega = S·φ(d1)·√T (always positive); Theta usually negative for long calls; Rho positive for calls.`,
    keyNotes: [
      'Price = discounted risk-neutral expected payoff.',
      'd1 drives Delta = N(d1); d2 is the risk-neutral ITM probability.',
      'The model prices VOLATILITY, not the stock drift.',
      'Constant-vol assumption => the volatility smile in real markets.',
      'Delta N(d1), Vega S·φ(d1)·√T.',
    ],
    practice: [
      { q: 'What measure is used to take the expectation in BS?', a: 'The risk-neutral measure (stock drift = r).' },
      { q: 'What does N(d1) represent?', a: 'The option delta (hedge ratio).' },
      { q: 'Why does a real market have a volatility smile if BS assumes constant vol?', a: 'Because constant vol + lognormal returns is false; crash fear and supply/demand skew implied vol by strike.' },
    ],
    videos: [
      { title: 'Black-Scholes intuition (Khan / MIT 18.S096)', url: 'https://www.youtube.com/results?search_query=black+scholes+intuition', minutes: 20 },
    ],
    sources: [
      { label: 'Hull, ch. 14-15' },
      { label: 'Green book — Black-Scholes & Greeks' },
    ],
  },
  {
    id: 'ls-dcf',
    trackId: 'finance',
    title: 'Walk Me Through a DCF',
    summary: 'Building an intrinsic equity value from projected free cash flows discounted at the WACC.',
    difficulty: 'beginner',
    tags: ['valuation', 'ib', 'dcf'],
    order: 1,
    estMinutes: 15,
    elaboration:
`A Discounted Cash Flow values a business as the present value of cash it will generate, plus the value of its ending state.

Steps an interviewer wants:
1. Project unlevered Free Cash Flow (FCFF = EBIT·(1-tax) + D&A - CapEx - change in NWC) for ~5 years.
2. Estimate a terminal value — either Gordon growth (FCF·(1+g)/(WACC-g)) or an exit multiple (EV/EBITDA × final-year EBITDA).
3. Discount each FCF and the terminal value back at the WACC.
4. Sum to get Enterprise Value.
5. Bridge to equity: EV - net debt - preferred + cash = Equity Value; divide by diluted shares for the per-share intrinsic value.

Watch-outs:
- WACC must match the cash flows (unlevered FCF -> WACC; levered FCF -> cost of equity).
- Terminal value is usually 60-80% of total value, so the growth/exit-multiple assumption dominates — sanity check it.
- DCF gives an intrinsic value; always triangulate with multiples and a footballd-field of methodologies.`,
    keyNotes: [
      'FCFF = EBIT(1-t) + D&A - CapEx - ΔNWC.',
      'Terminal value via Gordon growth or exit multiple (dominates the value).',
      'Discount at WACC; sum to Enterprise Value.',
      'EV -> Equity: subtract net debt, add cash, divide by shares.',
      'Triangulate with comps; DCF is one input, not the answer.',
    ],
    practice: [
      { q: 'Name the two terminal-value methods.', a: 'Gordon (perpetual) growth and an exit / trading multiple.' },
      { q: 'What do you subtract from EV to reach equity value?', a: 'Net debt (debt minus cash) and preferred; add cash.' },
      { q: 'Why is WACC the right discount rate for FCFF?', a: 'FCFF is capital-structure-neutral (unlevered), so it is discounted at the weighted average cost of capital.' },
    ],
    videos: [
      { title: 'DCF walkthrough (Wall Street Prep / BIWS)', url: 'https://www.youtube.com/results?search_query=walk+me+through+a+dcf', minutes: 15 },
    ],
    sources: [
      { label: 'Wall Street Prep — red book, Valuation' },
      { label: 'BIWS 400 Questions — valuation section' },
    ],
  },
  {
    id: 'ls-three-statements',
    trackId: 'finance',
    title: 'The Three Financial Statements',
    summary: 'How the income statement, balance sheet and cash-flow statement link together.',
    difficulty: 'beginner',
    tags: ['ib', 'accounting', 'financial-statements'],
    order: 0,
    estMinutes: 12,
    elaboration:
`The three statements are one connected system, not three separate pages.

- Income Statement: revenue - expenses = Net Income. Net income flows to the Balance Sheet (Retained Earnings) and is the top of the Cash Flow Statement.
- Cash Flow Statement: starts with Net Income, adds back non-cash (D&A), adjusts for working-capital changes, then Capex (Investing) and financing (debt/equity/dividends). The bottom line is the change in Cash, which lands on the Balance Sheet as Cash.
- Balance Sheet: Assets = Liabilities + Equity. It re-balances every period via Retained Earnings (from NI) and the cash change (from CFS).

The classic links to memorise:
1. NI (IS) -> Retained Earnings (BS) and CFS top line.
2. D&A (IS) -> added back on CFS, reduces PP&E on BS via accumulation.
3. CapEx (CFS) -> PP&E (BS).
4. CFS ending cash -> Cash (BS).
5. Debt drawdown / equity issuance (CFS) -> corresponding BS lines.`,
    keyNotes: [
      'IS net income -> Retained Earnings (BS) and CFS top line.',
      'D&A added back on CFS, reduces net PP&E via accumulated depreciation.',
      'CapEx (CFS) builds PP&E (BS).',
      'CFS ending cash = Cash on BS.',
      'Balance sheet must always tie: A = L + E.',
    ],
    practice: [
      { q: 'Where does net income end up on the other two statements?', a: 'Retained Earnings on the BS and the first line of the CFS.' },
      { q: 'Why is D&A added back on the cash-flow statement?', a: 'It is a non-cash expense that reduced net income but did not use cash.' },
      { q: 'What keeps the balance sheet in balance each period?', a: 'Retained earnings (from NI) and the cash change (from CFS).' },
    ],
    videos: [
      { title: 'Three financial statements linked (BIWS)', url: 'https://www.youtube.com/results?search_query=three+financial+statements+linked', minutes: 12 },
    ],
    sources: [
      { label: 'Wall Street Prep — red book, Accounting' },
      { label: 'BIWS 400 Questions — accounting' },
    ],
  },
  {
    id: 'ls-expectation-variance',
    trackId: 'academics',
    title: 'Expectation & Variance',
    summary: 'The first two moments of a distribution and the rules you use constantly in quant.',
    difficulty: 'beginner',
    tags: ['probability', 'statistics', 'math'],
    order: 0,
    estMinutes: 10,
    elaboration:
`Expectation E[X] is the probability-weighted average (the mean). Variance Var(X) = E[(X-E[X])²] = E[X²] - E[X]² measures spread.

Rules you must know cold:
- Linearity: E[aX + bY] = aE[X] + bE[Y] (no independence needed).
- Var(aX + b) = a²Var(X).
- If X, Y independent: Var(X+Y) = Var(X) + Var(Y). With covariance: Var(X+Y) = Var(X)+Var(Y)+2Cov(X,Y).
- Cov(X,Y) = E[XY] - E[X]E[Y]; correlation = Cov/ (σx σy).

Why it matters in quant: returns are random variables; portfolio variance uses the covariance matrix; the Sharpe ratio is mean divided by std; almost every estimator is an expectation. Knowing the independent-vs-correlated variance rule prevents the most common interview mistake.`,
    keyNotes: [
      'E[aX+bY] = aE[X]+bE[Y] (always).',
      'Var(aX+b) = a²Var(X).',
      'Independent: Var(X+Y)=Var(X)+Var(Y).',
      'Correlated: +2Cov(X,Y).',
      'Cov = E[XY]-E[X]E[Y]; corr = Cov/(σxσy).',
    ],
    practice: [
      { q: 'E[aX + b] = ?', a: 'a·E[X] + b.' },
      { q: 'Var(X+Y) when X,Y independent?', a: 'Var(X) + Var(Y).' },
      { q: 'Covariance formula?', a: 'E[XY] - E[X]E[Y].' },
    ],
    videos: [
      { title: 'Expectation and variance (StatQuest)', url: 'https://www.youtube.com/results?search_query=expectation+variance+statquest', minutes: 10 },
    ],
    sources: [
      { label: 'Any intro probability text — WSP quant math' },
    ],
  },
  {
    id: 'ls-linear-regression',
    trackId: 'ai',
    title: 'Linear Regression Intuition',
    summary: 'Fitting a line by minimising squared error, and how to read its coefficients.',
    difficulty: 'beginner',
    tags: ['ml', 'statistics', 'regression'],
    order: 0,
    estMinutes: 12,
    elaboration:
`Ordinary Least Squares fits β that minimises the sum of squared residuals: min_β Σ(yi - x_i·β)². Closed form: β = (XᵀX)⁻¹Xᵀy.

Intuition:
- Each coefficient βj is the change in y for a one-unit change in xj, holding other features constant (ceteris paribus).
- R² is the fraction of variance in y explained by X.
- The model assumes errors are independent, homoscedastic (constant variance), and (for inference) roughly normal; and that X is exogenous (no omitted-variable bias, no measurement error).

Pitfalls interviewers probe:
- Multicollinearity inflates standard errors (coefficients unstable) — check VIF.
- Overfitting: more features can raise R² even on noise; use adjusted R² / out-of-sample.
- Correlation ≠ causation: a coefficient is associative, not causal, unless you have a clean design.`,
    keyNotes: [
      'OLS minimises squared residuals; β = (XᵀX)⁻¹Xᵀy.',
      'βj = effect of xj holding others constant.',
      'R² = share of y-variance explained.',
      'Watch multicollinearity (VIF) and overfitting.',
      'Coefficients are associative, not automatically causal.',
    ],
    practice: [
      { q: 'What does OLS minimise?', a: 'The sum of squared residuals.' },
      { q: 'Closed-form β?', a: '(XᵀX)⁻¹Xᵀy.' },
      { q: 'What problem does multicollinearity cause?', a: 'Inflated standard errors / unstable coefficients.' },
    ],
    videos: [
      { title: 'Linear regression (StatQuest)', url: 'https://www.youtube.com/results?search_query=linear+regression+statquest', minutes: 12 },
    ],
    sources: [
      { label: 'ISLR — ch. 3' },
    ],
  },
];
