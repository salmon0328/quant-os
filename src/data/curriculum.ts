import type { CurriculumMonth, CurriculumWeek, PillarId } from '../models';

function wk(
  week: number,
  primaryPillar: PillarId,
  learningGoal: string,
  outputGoal: string,
  careerGoal: string,
  reviewGoal: string,
  topics: string[]
): CurriculumWeek {
  return { week, primaryPillar, learningGoal, outputGoal, careerGoal, reviewGoal, topics };
}

export const CURRICULUM: CurriculumMonth[] = [
  {
    month: 1,
    theme: 'Python + Probability + Finance Fundamentals',
    focus: ['pandas', 'probability', 'markets overview', 'returns & volatility'],
    weeks: [
      wk(1, 'programming', 'pandas & rolling calculations; returns/log-returns', 'Notebook computing historical (realised) volatility from price data', 'Set up a clean GitHub repo + README for your quant work', 'Weekly review + define your single most important output', ['pandas rolling', 'log returns', 'annualising vol']),
      wk(2, 'finance', 'Market instruments: equities, bonds, rates, FX, commodities', 'One-page cheat-sheet mapping each asset class + what drives it', 'Research one quant firm and its strategy focus', 'Review: which asset class is least intuitive to you?', ['equities', 'bonds', 'FX', 'commodities']),
      wk(3, 'academics', 'Probability refresher: distributions, moments, correlation/covariance', 'Notebook: simulate returns, plot distributions, estimate moments', 'Message a senior about their quant learning path', 'Spaced review: correlation vs covariance vs beta', ['distributions', 'moments', 'covariance']),
      wk(4, 'programming', 'NumPy vectorisation + matplotlib visualisation', 'Refactor Week 1 vol notebook to vectorised NumPy + clean plots', 'Analyse one quant/AI job description; list gaps', 'Monthly review: baseline capability snapshot', ['numpy', 'vectorisation', 'plotting']),
    ],
  },
  {
    month: 2,
    theme: 'Options + Black-Scholes + ML Foundations',
    focus: ['Hull options', 'Black-Scholes', 'CS229 foundations'],
    weeks: [
      wk(5, 'finance', 'Hull: Futures + Options basics + payoffs', 'Payoff diagram plotter for calls/puts/spreads', 'Follow a derivatives-focused researcher; note one insight', 'Recall: long call vs long put payoff/breakeven', ['futures', 'call/put', 'payoffs']),
      wk(6, 'finance', 'Hull: Trading strategies + Put-Call Parity', 'Notebook verifying put-call parity on real option quotes', 'Research a market-making / options desk role', 'Review: what does put-call parity assume?', ['strategies', 'put-call parity']),
      wk(7, 'ai', 'CS229: linear & logistic regression, regularisation', 'Implement linear + logistic regression from scratch (NumPy)', 'Ask a professor about research opportunities', 'Recall: bias/variance tradeoff intuition', ['linear regression', 'logistic', 'regularisation']),
      wk(8, 'finance', 'Hull: Binomial trees → Black-Scholes derivation', 'Black-Scholes option pricing calculator (Project 1)', 'Draft/update CV with quant-relevant projects', 'Monthly review: options confidence check', ['binomial tree', 'black-scholes']),
    ],
  },
  {
    month: 3,
    theme: 'Volatility + GARCH + HAR',
    focus: ['Greeks', 'implied vol', 'volatility models'],
    weeks: [
      wk(9, 'finance', 'Hull: Greeks (delta, gamma, vega, theta, rho)', 'Greeks calculator + sensitivity plots', 'Research a volatility-trading role/firm', 'Recall: what does each Greek measure?', ['delta', 'gamma', 'vega', 'theta']),
      wk(10, 'finance', 'Implied volatility + volatility smile/surface', 'Implied Volatility Solver (Project 2) using SciPy root-finding', 'Message an alumnus in quant/trading', 'Review: why does the smile exist?', ['implied vol', 'smile', 'surface']),
      wk(11, 'finance', 'Historical vs realised vs implied volatility', 'Historical vs Implied Volatility Analysis (Project 3)', 'Attend/plan a finance or quant workshop', 'Recall: realised vs implied vol difference', ['realised vol', 'HV vs IV']),
      wk(12, 'finance', 'GARCH volatility modelling', 'GARCH Volatility Forecast (Project 4)', 'Research one quant fund’s published research', 'Monthly review: volatility toolkit status', ['GARCH', 'volatility clustering']),
    ],
  },
  {
    month: 4,
    theme: 'Time Series + Financial ML',
    focus: ['HAR', 'time-series forecasting', 'leakage'],
    weeks: [
      wk(13, 'finance', 'HAR model for realised volatility', 'HAR Volatility Forecast (Project 5)', 'Compare two firms’ quant research styles', 'Recall: HAR components (daily/weekly/monthly)', ['HAR', 'realised vol']),
      wk(14, 'research', 'Backtesting basics + look-ahead bias + out-of-sample', 'GARCH vs HAR out-of-sample comparison (Project 6)', 'Follow up with a previous contact', 'Review: how did you avoid look-ahead bias?', ['out-of-sample', 'look-ahead bias']),
      wk(15, 'ai', 'Financial ML: labelling, CV pitfalls (López de Prado)', 'Notebook: purged/embargoed cross-validation demo', 'Research a financial-ML / systematic role', 'Recall: why standard k-fold leaks in finance', ['purged CV', 'labelling']),
      wk(16, 'research', 'Overfitting, transaction costs, evaluation metrics', 'Report: Sharpe, drawdown, turnover for a toy strategy', 'Analyse a quant researcher job description', 'Monthly review: research rigour check', ['overfitting', 'transaction costs', 'sharpe']),
    ],
  },
  {
    month: 5,
    theme: 'Portfolio Construction + Factor Models',
    focus: ['factors', 'risk', 'portfolio optimisation'],
    weeks: [
      wk(17, 'finance', 'Factor models (value, momentum, quality, size)', 'Compute factor exposures for a stock universe', 'Research a factor-investing / systematic equity firm', 'Recall: what a factor premium represents', ['factors', 'exposures']),
      wk(18, 'finance', 'Portfolio construction & mean-variance optimisation', 'Mean-variance optimiser notebook', 'Message a portfolio manager / researcher', 'Review: limitations of mean-variance', ['MVO', 'covariance estimation']),
      wk(19, 'finance', 'Risk management: VaR, expected shortfall, drawdown', 'Risk report for your factor portfolio', 'Attend an investment/quant event', 'Recall: VaR vs expected shortfall', ['VaR', 'expected shortfall']),
      wk(20, 'finance', 'Full factor backtest with costs', 'Quantitative Factor Backtesting (Project 7)', 'Apply to one relevant internship/competition', 'Monthly review: portfolio & risk status', ['factor backtest', 'costs']),
    ],
  },
  {
    month: 6,
    theme: 'Research Methodology + Paper Replication',
    focus: ['reading papers', 'hypotheses', 'replication'],
    weeks: [
      wk(21, 'research', 'How to read papers + the 10-point critique template', 'Critique of 1 quant-finance or ML paper', 'Ask a professor to suggest a paper to replicate', 'Recall: how to identify a research question', ['paper reading', 'critique']),
      wk(22, 'research', 'Hypotheses, experiment design, baselines', 'Experiment plan for a replication (question/method/baseline)', 'Discuss the plan with a senior/mentor', 'Review: what makes a fair baseline?', ['hypotheses', 'baselines']),
      wk(23, 'research', 'Dataset construction + avoiding data leakage', 'Clean, documented dataset for your replication', 'Research a research-assistant opportunity', 'Recall: sources of leakage in your dataset', ['datasets', 'leakage']),
      wk(24, 'research', 'Ablations, statistical tests, writing findings', 'Replication write-up with ablation + significance test', 'Draft a short research summary to share', 'Monthly review: research methodology status', ['ablation', 'statistical tests']),
    ],
  },
  {
    month: 7,
    theme: 'Advanced ML / Reinforcement Learning',
    focus: ['deep learning', 'RL', 'PPO'],
    weeks: [
      wk(25, 'ai', 'Neural nets, backprop, optimisation', 'Implement an MLP + backprop from scratch', 'Research an AI-research lab/role', 'Recall: chain rule in backprop', ['backprop', 'optimisers']),
      wk(26, 'ai', 'Sutton & Barto: MDPs, Bellman, DP, Monte Carlo, TD', '200-word MDP explainer + gridworld value iteration', 'Message a researcher doing RL', 'Recall: Bellman optimality equation', ['MDP', 'bellman', 'TD']),
      wk(27, 'ai', 'Q-learning + policy gradients + actor-critic', 'Tabular Q-learning agent on a toy environment', 'Connect your Tencent RL work to a target role', 'Review: value-based vs policy-based methods', ['q-learning', 'policy gradient']),
      wk(28, 'ai', 'PPO + reward modelling', 'RL implementation/experiment (Project 9) — PPO baseline', 'Write a short post on your RL project', 'Monthly review: RL capability status', ['PPO', 'actor-critic', 'reward modelling']),
    ],
  },
  {
    month: 8,
    theme: 'AI × Finance Project',
    focus: ['applied ML in markets', 'end-to-end pipeline'],
    weeks: [
      wk(29, 'ai', 'Framing an AI×finance problem (vol/return forecasting)', 'Problem statement + dataset spec (Project 8)', 'Research groups doing AI×finance', 'Recall: what makes finance ML hard', ['problem framing', 'features']),
      wk(30, 'ai', 'Feature engineering + baseline model', 'Baseline model with honest OOS evaluation', 'Discuss approach with a mentor', 'Review: baseline vs naive benchmark', ['features', 'baseline']),
      wk(31, 'ai', 'Model iteration + regularisation + validation', 'Improved model + ablation study', 'Draft project into portfolio format', 'Recall: guarding against overfitting', ['iteration', 'validation']),
      wk(32, 'research', 'Write-up + honest limitations', 'AI×Finance project report (Project 8 complete)', 'Share the project with a contact for feedback', 'Monthly review: applied project status', ['write-up', 'limitations']),
    ],
  },
  {
    month: 9,
    theme: 'Advanced Quant Research',
    focus: ['deeper models', 'novel questions'],
    weeks: [
      wk(33, 'research', 'Identify a research gap in vol/factor/ML literature', 'One-page research proposal', 'Discuss the gap with a professor', 'Recall: how to spot a research gap', ['gaps', 'proposal']),
      wk(34, 'finance', 'Advanced volatility (forecasting, surface dynamics)', 'Extend your vol model with a new feature/model', 'Research a vol-arb / systematic role', 'Review: forecasting evaluation metrics', ['vol forecasting', 'surface']),
      wk(35, 'ai', 'Transformers/attention for sequences (optional finance)', 'Small Transformer experiment on sequence data', 'Follow a lab’s recent publications', 'Recall: self-attention mechanics', ['attention', 'transformers']),
      wk(36, 'research', 'Consolidate into a mini research paper', 'Draft mini-paper (intro/method/results)', 'Ask for feedback from a mentor', 'Monthly review: research depth status', ['paper draft']),
    ],
  },
  {
    month: 10,
    theme: 'Internship / Interview Preparation',
    focus: ['DS&A depth', 'quant interviews', 'behavioural'],
    weeks: [
      wk(37, 'programming', 'DS&A: trees, graphs, heaps', 'Solve + explain 4 medium problems (graphs/trees)', 'Shortlist target firms & deadlines', 'Recall: BFS vs DFS use-cases', ['trees', 'graphs', 'heaps']),
      wk(38, 'programming', 'Dynamic programming patterns', 'Solve + explain 4 DP problems', 'Prepare tailored CVs per target', 'Review: identifying DP subproblems', ['dynamic programming']),
      wk(39, 'finance', 'Quant interview: probability, brainteasers, mental math', 'Log of 20 practice questions with solutions', 'Do 1 mock interview with a peer', 'Recall: common probability traps', ['probability puzzles', 'mental math']),
      wk(40, 'career', 'Behavioural + project storytelling', 'STAR stories for each major project', 'Submit applications to shortlisted roles', 'Monthly review: interview readiness', ['behavioural', 'storytelling']),
    ],
  },
  {
    month: 11,
    theme: 'Research / Project Portfolio',
    focus: ['polish', 'communicate', 'publish'],
    weeks: [
      wk(41, 'programming', 'Repo hygiene, docs, reproducibility', 'Clean READMEs + reproducible notebooks for all projects', 'Publish portfolio (GitHub/site)', 'Review: is each project reproducible?', ['reproducibility', 'docs']),
      wk(42, 'research', 'Turn best project into a write-up/blog', 'Polished blog post or short paper', 'Share portfolio with 2 contacts', 'Recall: explaining results to non-experts', ['communication']),
      wk(43, 'finance', 'Backtest audit: leakage, costs, robustness', 'Robustness appendix for your backtests', 'Research PhD/master’s or industry pathways', 'Review: robustness checks done', ['robustness', 'audit']),
      wk(44, 'career', 'Portfolio presentation & pitch', 'Recorded 5-min portfolio walkthrough', 'Interview / networking conversations', 'Monthly review: portfolio quality', ['pitch', 'presentation']),
    ],
  },
  {
    month: 12,
    theme: 'Review + Specialisation Decision',
    focus: ['synthesis', 'direction', 'next steps'],
    weeks: [
      wk(45, 'research', 'Synthesise a year of learning & outputs', 'Year-in-review document with metrics', 'Reflect on which conversations energised you', 'Review: biggest ROI activities', ['synthesis']),
      wk(46, 'career', 'Evaluate paths: quant finance/research/trading vs AI', 'Decision matrix scoring each career path', 'Talk to someone in your top-2 paths', 'Recall: your comparative advantages', ['decision matrix']),
      wk(47, 'finance', 'Deep-dive your chosen specialisation', 'Focused advanced output in chosen area', 'Target opportunities in that specialisation', 'Review: fit vs interest vs skill', ['specialisation']),
      wk(48, 'research', 'Plan Year 3: goals, projects, roadmap v2', 'Next-year roadmap (adaptive)', 'Set concrete application targets', 'Monthly + annual review', ['planning', 'roadmap v2']),
    ],
  },
];

export function getAllWeeks(): CurriculumWeek[] {
  return CURRICULUM.flatMap((m) => m.weeks);
}

export function weekForIndex(weekIndex: number): CurriculumWeek {
  const weeks = getAllWeeks();
  const idx = ((weekIndex - 1) % weeks.length + weeks.length) % weeks.length;
  return weeks[idx];
}
