import type { Pillar } from '../models';

export const PILLARS: Pillar[] = [
  {
    id: 'academics',
    name: 'Academics',
    score: 70,
    targetHoursPerWeek: 3,
    color: '#8b5cf6',
    description:
      'University performance + mathematical/statistical foundations (probability, stats, linear algebra, optimisation, econometrics, time series, ML maths).',
  },
  {
    id: 'programming',
    name: 'Programming / CS',
    score: 60,
    targetHoursPerWeek: 4,
    color: '#3b82f6',
    description:
      'Strong programmer able to implement research & build production systems: Python, NumPy/pandas/SciPy, DS&A, Git, Linux, SQL, software engineering.',
  },
  {
    id: 'ai',
    name: 'AI / Machine Learning',
    score: 65,
    targetHoursPerWeek: 4,
    color: '#10b981',
    description:
      'Research-level ML understanding: foundations → deep learning → reinforcement learning → LLM/multimodal.',
  },
  {
    id: 'finance',
    name: 'Financial Markets / Quant',
    score: 45,
    targetHoursPerWeek: 4,
    color: '#f59e0b',
    description:
      'Genuine market understanding: instruments, options/derivatives (Hull), volatility, factor models, risk & backtesting.',
  },
  {
    id: 'research',
    name: 'Research',
    score: 40,
    targetHoursPerWeek: 3,
    color: '#ec4899',
    description:
      'Independent quant/AI research: reading papers, hypotheses, experiments, baselines, ablations, avoiding leakage, writing up findings.',
  },
  {
    id: 'career',
    name: 'Career / Networking',
    score: 30,
    targetHoursPerWeek: 1,
    color: '#ef4444',
    description:
      'Increase probability of strong internships/research/career outcomes through deliberate, non-spam networking and applications.',
  },
];
