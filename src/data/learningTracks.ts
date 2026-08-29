import type { PillarId } from '../models';

export interface Track {
  pillar: PillarId;
  title: string;
  stages: { name: string; topics: string[] }[];
}

export const LEARNING_TRACKS: Track[] = [
  {
    pillar: 'ai',
    title: 'AI / Machine Learning',
    stages: [
      { name: 'Foundations', topics: ['Linear regression', 'Logistic regression', 'Regularisation', 'Bias/variance', 'Train/validation/test', 'Cross-validation', 'Feature engineering', 'Decision trees', 'Random forests', 'Gradient boosting', 'PCA', 'Clustering'] },
      { name: 'Deep Learning', topics: ['Neural networks', 'Backpropagation', 'Optimisation', 'CNNs', 'RNNs', 'Transformers', 'Attention', 'Embeddings'] },
      { name: 'Reinforcement Learning', topics: ['MDPs', 'States/actions/rewards', 'Bellman equations', 'Dynamic programming', 'Monte Carlo', 'TD learning', 'Q-learning', 'Policy gradients', 'Actor-critic', 'PPO', 'Reward modelling'] },
      { name: 'LLM / Multimodal', topics: ['Transformers (deep)', 'LLM inference', 'Agents', 'Tool use', 'Multimodal models', 'Speech/audio models', 'RL for LLMs'] },
    ],
  },
  {
    pillar: 'finance',
    title: 'Financial Markets / Quant',
    stages: [
      { name: 'Markets & Stats', topics: ['Equities', 'Bonds', 'Interest rates', 'FX', 'Commodities', 'Futures', 'Options', 'Returns', 'Volatility', 'Correlation', 'Covariance', 'Distributions', 'Time series'] },
      { name: 'Options (Hull)', topics: ['Futures', 'Options basics', 'Payoffs', 'Trading strategies', 'Put-call parity', 'Binomial trees', 'Black-Scholes', 'Greeks', 'Volatility', 'Implied volatility', 'Volatility smile', 'Volatility surface', 'Hedging', 'Volatility trading'] },
      { name: 'Volatility & Forecasting', topics: ['Historical volatility', 'Realised volatility', 'Implied volatility', 'GARCH', 'HAR', 'Volatility forecasting', 'Time-series forecasting'] },
      { name: 'Portfolio & Risk', topics: ['Factor models', 'Portfolio construction', 'Risk management', 'Backtesting', 'Out-of-sample testing', 'Look-ahead bias', 'Overfitting', 'Transaction costs', 'Sharpe ratio', 'Drawdown', 'VaR', 'Expected shortfall'] },
    ],
  },
  {
    pillar: 'programming',
    title: 'Programming / Computer Science',
    stages: [
      { name: 'Core Python & Libraries', topics: ['Python', 'NumPy', 'pandas', 'matplotlib', 'SciPy'] },
      { name: 'CS Fundamentals', topics: ['Data structures', 'Algorithms', 'Debugging', 'Performance optimisation'] },
      { name: 'Engineering', topics: ['Git', 'Linux', 'SQL', 'APIs', 'Software engineering'] },
      { name: 'LeetCode Patterns', topics: ['Arrays', 'Hash maps', 'Strings', 'Two pointers', 'Sliding window', 'Binary search', 'Stacks', 'Queues', 'Heaps', 'Trees', 'Graphs', 'Dynamic programming'] },
    ],
  },
  {
    pillar: 'academics',
    title: 'Academics — Mathematical Foundations',
    stages: [
      { name: 'Core Maths', topics: ['Probability', 'Statistics', 'Linear algebra', 'Calculus', 'Optimisation'] },
      { name: 'Applied Stats', topics: ['Econometrics', 'Time series', 'Machine learning mathematics'] },
    ],
  },
  {
    pillar: 'research',
    title: 'Research Methodology',
    stages: [
      { name: 'Reading & Framing', topics: ['Read papers', 'Identify research questions', 'Formulate hypotheses', 'Identify research gaps', 'Critique papers'] },
      { name: 'Experiments', topics: ['Design experiments', 'Construct datasets', 'Build baselines', 'Perform ablation studies', 'Evaluate models', 'Conduct statistical tests'] },
      { name: 'Rigour', topics: ['Avoid data leakage', 'Avoid look-ahead bias', 'Out-of-sample testing', 'Write research findings'] },
    ],
  },
];
