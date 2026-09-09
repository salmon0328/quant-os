import type { AptitudeKind } from '../models';

/**
 * Firm screen presets.
 *
 * Each runs the batteries that firm's online assessment actually leans on, so
 * a practice session looks like the real thing rather than whichever game you
 * happen to enjoy. Pass marks are indicative, drawn from what candidates
 * commonly report rather than anything published — they are a target to beat,
 * not a promise.
 */
export interface FirmPreset {
  id: string;
  firm: string;
  blurb: string;
  stages: { kind: AptitudeKind; target: string }[];
}

export const FIRM_PRESETS: FirmPreset[] = [
  {
    id: 'optiver',
    firm: 'Optiver',
    blurb: 'Famous for the 80-in-8 arithmetic screen, followed by pattern and speed work.',
    stages: [
      { kind: 'blitz', target: '60+ correct is a competitive score' },
      { kind: 'patterns', target: '8+ of 10' },
      { kind: 'zap', target: '35+ correct at 90% accuracy' },
    ],
  },
  {
    id: 'sig',
    firm: 'SIG',
    blurb: 'Poker-adjacent: expected value, decision-making under uncertainty, and quoting markets.',
    stages: [
      { kind: 'ev', target: '14+ of 20' },
      { kind: 'making', target: 'Positive P&L with an average width under 4' },
    ],
  },
  {
    id: 'janestreet',
    firm: 'Jane Street',
    blurb: 'Probability and estimation, with mental arithmetic assumed rather than tested directly.',
    stages: [
      { kind: 'ev', target: '15+ of 20' },
      { kind: 'blitz', target: '50+ correct' },
      { kind: 'making', target: 'Positive P&L' },
    ],
  },
  {
    id: 'imc',
    firm: 'IMC',
    blurb: 'Timed arithmetic and sequences, then a market-making conversation.',
    stages: [
      { kind: 'blitz', target: '55+ correct' },
      { kind: 'patterns', target: '7+ of 10' },
      { kind: 'making', target: 'Break even or better' },
    ],
  },
  {
    id: 'akuna',
    firm: 'Akuna Capital',
    blurb: 'Options-flavoured maths plus speed rounds.',
    stages: [
      { kind: 'ev', target: '13+ of 20' },
      { kind: 'blitz', target: '50+ correct' },
    ],
  },
];

export const PRESET_BY_ID = new Map(FIRM_PRESETS.map((p) => [p.id, p]));
