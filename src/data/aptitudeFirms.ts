import type { AptitudeKind } from '../models';

// ---------------------------------------------------------------------------
// Question banks
// ---------------------------------------------------------------------------

export interface ProbabilityQuestion {
  q: string;
  /** Numeric answer, compared with a tolerance so 1/3 and 0.333 both pass. */
  a: number;
  /** Absolute tolerance for "correct". Defaults to 0.01. */
  tol?: number;
  /** Short derivation shown after answering - the point is the reasoning. */
  why: string;
}

export const PROBABILITY: ProbabilityQuestion[] = [
  { q: 'Expected number of rolls of a fair die until the first 6.', a: 6, why: 'Geometric with p = 1/6, so E = 1/p = 6.' },
  { q: 'Fair price to play: roll a die once and receive $ equal to the roll.', a: 3.5, why: 'E[roll] = (1+2+3+4+5+6)/6 = 3.5.' },
  { q: 'A family has 2 children. At least one is a boy. Probability both are boys?', a: 1 / 3, why: 'Valid families BB, BG, GB (GG excluded). Only BB works, so 1/3.' },
  { q: 'Flip 3 fair coins. Probability of exactly 2 heads?', a: 0.375, why: 'C(3,2)/2^3 = 3/8.' },
  { q: 'Roll two dice. Probability the sum is 7?', a: 1 / 6, why: '6 of 36 outcomes sum to 7, so 6/36 = 1/6.' },
  { q: 'Monty Hall: probability of winning the car if you always switch?', a: 2 / 3, why: 'Switching wins whenever your first pick was wrong, which is 2/3 of the time.' },
  { q: 'Draw 2 cards from 52 without replacement. Probability both are aces?', a: 1 / 221, tol: 0.001, why: '(4/52)(3/51) = 12/2652 = 1/221.' },
  { q: '100-seat airplane: first passenger sits randomly, rest take their seat if free. Probability the last passenger gets their own seat?', a: 0.5, why: 'Classic symmetry: the last seat is either the first passenger\'s or the last passenger\'s, equally likely.' },
  { q: 'Symmetric random walk, 4 steps. Probability of being back at the start?', a: 0.375, why: 'Need 2 left + 2 right: C(4,2)/2^4 = 6/16.' },
  { q: 'Coupon collector with 3 equally likely coupons. Expected draws to collect all 3?', a: 5.5, why: '3(1/3 + 1/2 + 1/1) = 3 x 11/6 = 5.5.' },
  { q: 'Birthday problem: probability of a shared birthday among 23 people?', a: 0.5073, tol: 0.01, why: '1 - (365 x 364 x ... x 343)/365^23 ~ 0.507.' },
  { q: 'Expected maximum of two fair dice.', a: 161 / 36, tol: 0.01, why: 'Sum over k of k x P(max = k); P(max<=k) = (k/6)^2, giving 161/36 ~ 4.47.' },
  { q: 'Biased coin, P(heads) = 0.3. Expected flips until the first heads?', a: 10 / 3, tol: 0.01, why: 'Geometric: E = 1/0.3 = 3.33.' },
  { q: 'A dart lands uniformly in a circle of radius R. Probability it lands within radius R/2?', a: 0.25, why: 'Area scales with the square of the radius: (1/2)^2 = 1/4.' },
  { q: 'Roll a die 4 times. Probability of exactly one 6?', a: 500 / 1296, tol: 0.01, why: 'C(4,1)(1/6)(5/6)^3 = 500/1296 ~ 0.386.' },
  { q: 'Expected number of fixed points in a random permutation of 5 items.', a: 1, why: 'Each position is fixed with probability 1/5; 5 x 1/5 = 1. (True for any n.)' },
  { q: 'Roll two dice. Probability the first strictly exceeds the second?', a: 15 / 36, tol: 0.01, why: '15 of the 36 ordered pairs; the other 21 are ties (6) or lower (15).' },
  { q: 'Urn has 3 red and 2 blue. Draw 2 without replacement. Probability both red?', a: 0.3, why: '(3/5)(2/4) = 6/20 = 0.3.' },
  { q: 'E[|X|] where X is standard normal.', a: 0.7979, tol: 0.01, why: 'sqrt(2/pi) ~ 0.798.' },
  { q: 'Game pays $2 on heads, costs $1 on tails (fair coin). Expected value per play?', a: 0.5, why: '0.5(2) + 0.5(-1) = 1 - 0.5 = 0.5.' },
  { q: 'Flip a fair coin 10 times. Expected number of heads?', a: 5, why: 'Binomial mean np = 10 x 0.5 = 5.' },
  { q: 'Two points chosen uniformly on a circle. Probability the chord between them is longer than the radius?', a: 2 / 3, why: 'Central angle exceeds 60 degrees with probability 240/360 = 2/3.' },
];

export interface FermiQuestion {
  q: string;
  /** Our worked estimate, used to grade the order of magnitude only. */
  estimate: number;
  /** The reasoning - the answer matters far less than the breakdown. */
  breakdown: string;
  unit: string;
}

export const FERMI: FermiQuestion[] = [
  { q: 'How many piano tuners are there in a city of 3 million?', estimate: 60, unit: 'tuners',
    breakdown: '3M people / 2.5 per household = 1.2M homes. ~1 in 20 has a piano = 60k pianos. Each tuned once a year, 2 per day, 250 working days = 500/year per tuner. 60,000 / 500 = 120... so somewhere near 60-120.' },
  { q: 'How many golf balls fit in a school bus?', estimate: 500000, unit: 'balls',
    breakdown: 'Bus ~ 8 x 2.5 x 2 m = 40 m^3, call it 35 m^3 of usable space. A golf ball is ~4 cm diameter = 3.35e-5 m^3. 35 / 3.35e-5 ~ 1e6, and sphere packing wastes ~26%, giving ~7e5. Order of 10^5-10^6.' },
  { q: 'How many hairs are on a human head?', estimate: 100000, unit: 'hairs',
    breakdown: 'Scalp ~ 600 cm^2. Hair density ~ 150-200 per cm^2 near the crown, sparser at the edges; average ~150. 600 x 150 ~ 90,000, so order 10^5.' },
  { q: 'How many litres of water are in the Earth\'s oceans?', estimate: 1.3e21, unit: 'litres',
    breakdown: 'Ocean area ~ 3.6e14 m^2 (71% of 5.1e14). Mean depth ~ 3.7 km. Volume ~ 1.35e18 m^3 = 1.35e21 litres.' },
  { q: 'How many text messages are sent worldwide per day?', estimate: 1e10, unit: 'messages',
    breakdown: '~5 billion messaging users, average ~20 messages/day on apps plus a smaller SMS tail. 5e9 x 2 = 1e10. Order 10^10.' },
  { q: 'How many trees are on Earth?', estimate: 3e12, unit: 'trees',
    breakdown: 'Nature 2015 estimate: ~3.04 trillion. Bottom-up: ~4e9 ha of forest at ~400-800 stems/ha plus savanna and urban.' },
  { q: 'How many cars are sold in the United States per year?', estimate: 1.5e7, unit: 'cars',
    breakdown: 'US light-vehicle sales run ~15-16 million a year. Cross-check: 330M people, ~1 car per 2 people = 165M fleet, replaced every ~12 years = ~14M/year.' },
  { q: 'How long would it take to count to one billion, out loud?', estimate: 3e9, unit: 'seconds',
    breakdown: 'Average spoken number takes ~3 seconds (the long ones dominate). 1e9 x 3 = 3e9 seconds ~ 95 years. Order 10^9 seconds.' },
  { q: 'How many cells are in the human body?', estimate: 3.7e13, unit: 'cells',
    breakdown: 'Bianconi et al. 2013 put it at 3.72e13, about 90% of them red blood cells. The older "10:1 bacteria to human cells" claim is outdated - the real ratio is close to 1:1.' },
  { q: 'How many air molecules are in a 5m x 5m x 3m room?', estimate: 1.5e27, unit: 'molecules',
    breakdown: 'Volume 75 m^3. At STP, 1 mole = 22.4 L = 2.24e-2 m^3. 75 / 2.24e-2 ~ 3350 moles. x 6.02e23 ~ 2e27. Order 10^27.' },
  { q: 'How many ping pong balls fit in a Boeing 747?', estimate: 2e7, unit: 'balls',
    breakdown: 'Cabin + cargo volume ~ 1000 m^3. Ball diameter 4 cm = 3.35e-5 m^3. 1000 / 3.35e-5 ~ 3e7, minus packing loss ~ 2e7.' },
  { q: 'How many Starbucks locations are there worldwide?', estimate: 3.5e4, unit: 'stores',
    breakdown: 'Company reported ~38,000 stores in 2024 across 80+ markets, roughly half in the US and half in China plus the rest.' },
  { q: 'How many pizzas are eaten in the US per day?', estimate: 1e7, unit: 'pizzas',
    breakdown: '330M people, ~1 in 8 eats pizza on a given day = ~40M servings; a pizza serves ~4 slices, so ~10M pizzas. Order 10^7.' },
  { q: 'How many times do the hands of a clock overlap in 12 hours?', estimate: 11, unit: 'times',
    breakdown: 'The minute hand laps the hour hand 11 times in 12 hours (not 12) because the hour hand also moves: 12:00, ~1:05, ... ~10:55.' },
];

export interface Brainteaser {
  q: string;
  options: string[];
  correct: number;
  why: string;
}

export const BRAINTEASERS: Brainteaser[] = [
  { q: 'You draw 10 straight lines across a circle, placing them to create as many crossing points as possible. What is the maximum number of intersections?',
    options: ['45', '50', '55', '56'], correct: 0,
    why: 'Every pair of lines can cross at most once, so the maximum is C(10,2) = 45. Note the common trap: 56 is the maximum number of *regions*, which is a different question - n(n+1)/2 + 1 = 56. Always confirm which quantity is being asked for.' },
  { q: 'Same circle, 10 lines: what is the maximum number of *regions* the circle is divided into?',
    options: ['45', '50', '56', '100'], correct: 2,
    why: 'The n-th line can cross the previous n-1 lines at most n-1 times, adding n new regions. Starting from 1: 1 + (1+2+...+10) = 1 + 55 = 56.' },
  { q: 'Two ropes each take exactly 60 minutes to burn, but burn unevenly. How do you measure 45 minutes?',
    options: ['Fold one rope in half', 'Light both ends of rope A and one end of rope B, then light B\'s other end when A finishes', 'Light both ropes at one end', 'Burn one, then half of the other'], correct: 1,
    why: 'Lighting rope A at both ends makes it burn in 30 minutes regardless of unevenness. At that moment light the far end of rope B, which has 30 minutes of burn time left from one end; burning from both ends finishes it in 15 more. Total 45.' },
  { q: 'Flipping a fair coin, which sequence takes fewer flips on average: HH or HT?',
    options: ['HH', 'HT', 'Same, 4 flips each', 'Same, 6 flips each'], correct: 1,
    why: 'E[HT] = 4 but E[HH] = 6. After a failed attempt at HH (a tail), you are back to needing two heads from scratch; after failing HT with a head you already have the first symbol of HT. Overlap matters.' },
  { q: '100 closed lockers. Pass 1 toggles every locker, pass 2 every second, pass 3 every third, ... pass 100 the 100th. How many are open at the end?',
    options: ['10', '50', '7', '25'], correct: 0,
    why: 'Locker n is toggled once per divisor of n, so it ends open iff n has an odd number of divisors - which happens exactly for perfect squares. Squares up to 100: 1,4,...,100, so 10 lockers.' },
  { q: 'Four people cross a bridge at night with one torch. They take 1, 2, 5 and 10 minutes; pairs move at the slower person\'s pace. Minimum total time?',
    options: ['19 min', '17 min', '15 min', '13 min'], correct: 1,
    why: 'Send 1+2 across (2), 1 returns (1), send 5+10 across (10), 2 returns (2), send 1+2 across (2). Total 17. The key is never sending the two slowest separately.' },
  { q: 'Nine identical balls, one is heavier. Using a balance scale, how many weighings do you need to guarantee finding it?',
    options: ['2', '3', '4', '1'], correct: 0,
    why: 'Each weighing has 3 outcomes, so k weighings distinguish up to 3^k cases. 3^2 = 9, so 2 weighings suffice: weigh 3 vs 3, then 1 vs 1 from the suspect group.' },
  { q: '1000 bottles of wine, one is poisoned and kills within a day. Minimum number of testers needed to identify it in one round?',
    options: ['10', '32', '100', '500'], correct: 0,
    why: 'Give each bottle a 10-bit number and have tester i sip from every bottle whose i-th bit is 1. The pattern of deaths spells out the poisoned bottle in binary; 2^10 = 1024 >= 1000.' },
  { q: 'Ants walk at 1 cm/s along a 1 metre stick. When two meet they both turn around. What is the longest any ant can remain on the stick?',
    options: ['100 s', '50 s', '200 s', 'It depends on the number of ants'], correct: 0,
    why: 'Two ants colliding and turning is indistinguishable from them passing through each other. So the maximum time is just the stick length divided by speed: 100 cm / 1 cm/s = 100 s, independent of the ant count.' },
  { q: 'Two trains 100 km apart approach at 50 km/h each. A fly at 75 km/h shuttles between them until they meet. How far does the fly travel?',
    options: ['100 km', '75 km', '150 km', 'Need to sum an infinite series'], correct: 1,
    why: 'The trains meet in 1 hour (100 km closing at 100 km/h). The fly flies 75 km/h for that hour = 75 km. Von Neumann reportedly answered instantly: "I summed the series."' },
  { q: '4 switches outside, one light bulb inside, switches all off. How many times must you enter the room to identify the switch?',
    options: ['1', '2', '3', '4'], correct: 0,
    why: 'Turn switch 1 on for a few minutes, then off; turn switch 2 on and enter. The bulb that is lit is switch 2; feel the two dark bulbs - the warm one is switch 1, the cold one switch 3, and the untouched one is switch 4.' },
  { q: 'A drawer has 10 black and 10 white socks. How many must you pull, in the dark, to guarantee a matching pair?',
    options: ['3', '11', '2', '20'], correct: 0,
    why: 'Pigeonhole: with 2 colours, the third sock must match one of the first two.' },
  { q: 'A deck is shuffled. Expected number of cards that end up in their original position?',
    options: ['1', '0', '4', '52/52 of a card'], correct: 0,
    why: 'Each of the 52 positions is a fixed point with probability 1/52, and expectation is linear regardless of dependence: 52 x 1/52 = 1.' },
  { q: 'Russian roulette: 6 chambers, 2 adjacent bullets. You spin, pull, and survive. Spin again, or fire without spinning?',
    options: ['Spin again', 'Do not spin', 'Makes no difference', 'Depends on the gun'], correct: 1,
    why: 'Spinning again gives P(death) = 2/6 = 1/3. Not spinning: having survived, you are in one of the 4 empty chambers, each equally likely. Only the empty chamber immediately preceding the bullet pair is followed by a bullet, so exactly 1 of those 4 positions is fatal: P(death) = 1/4. Since 1/4 < 1/3, do not spin.' },
  { q: 'With a 3-gallon and a 5-gallon jug and unlimited water, can you measure exactly 4 gallons?',
    options: ['Yes', 'No, only multiples of 1 up to 5', 'No, 4 is not reachable', 'Only with a third jug'], correct: 0,
    why: 'Fill the 5, pour into the 3 (2 left in the 5). Empty the 3, pour the 2 into it. Fill the 5 again and top up the 3, which takes 1 - leaving exactly 4 in the 5. gcd(3,5) = 1 so any integer volume is reachable.' },
  { q: 'You have a 10 x 10 grid of coins, all heads. You may flip any row or column. Can you reach a state with exactly one tail?',
    options: ['Yes', 'No', 'Only on odd grids', 'Only if you flip twice'], correct: 1,
    why: 'Invariant: each move flips 10 coins, changing the number of tails by an even amount (10 - 2k). Starting from 0 tails, the parity of the tail count can never become odd, so exactly 1 is unreachable.' },
];

// ---------------------------------------------------------------------------
// Which firms use which tests
// ---------------------------------------------------------------------------

export interface FirmOA {
  firm: string;
  /** What the assessment actually contains. */
  tests: string;
  /** Which drills in this app map onto it. */
  drills: AptitudeKind[];
  note?: string;
}

/**
 * Formats are collated from public firm-interview guides and candidate write-ups;
 * firms change them between cycles, so treat this as a starting point and check
 * the firm's own careers page before your assessment.
 */
export const FIRM_OA: FirmOA[] = [
  { firm: 'Optiver',
    tests: 'The 80-in-8 mental arithmetic test (80 questions, 8 minutes, no calculator), then Zap-N task switching and reaction drills.',
    drills: ['blitz', 'taskswitch', 'reaction', 'fractions'],
    note: 'Reported pass band is roughly 55+ correct out of 80. It is usually a one-shot test, so prepare before you take it.' },
  { firm: 'Jane Street',
    tests: 'Excel-based modelling and estimation (45-60 min): haircuts, option pricing, and probability/expected-value questions.',
    drills: ['probability', 'fermi', 'brainteaser'],
    note: 'Often no single "right" answer - the model structure and the assumptions are what get judged.' },
  { firm: 'IMC Trading',
    tests: 'Numerical reasoning plus probability under time pressure (~45 min), with working-memory components.',
    drills: ['probability', 'blitz', 'pincode'] },
  { firm: 'Akuna Capital',
    tests: 'Mixed aptitude: arithmetic, sequence patterns, spatial reasoning.',
    drills: ['patterns', 'blitz', 'gridrecall'] },
  { firm: 'Flow Traders',
    tests: 'Numerical and logical reasoning with reaction and concentration measures.',
    drills: ['blitz', 'patterns', 'reaction', 'flanker'] },
  { firm: 'SIG',
    tests: 'Probability, estimation and trading games, often discussion-led rather than purely timed.',
    drills: ['probability', 'fermi', 'brainteaser'] },
  { firm: 'DRW',
    tests: 'Probability and mental arithmetic alongside coding screens.',
    drills: ['probability', 'blitz'] },
  { firm: 'Chicago Trading Company',
    tests: 'Mental arithmetic, probability and spatial reasoning.',
    drills: ['blitz', 'probability', 'gridrecall'] },
  { firm: 'Mako Trading',
    tests: '37 questions in 15 minutes across arithmetic, logical reasoning, probability, spatial reasoning and pattern recognition - explicitly includes cube folding.',
    drills: ['blitz', 'patterns', 'probability', 'gridrecall'],
    note: 'About 24 seconds per question, so recognition speed matters more than depth.' },
  { firm: 'Maven Securities',
    tests: 'Numerical and logical reasoning.',
    drills: ['patterns', 'blitz'] },
  { firm: 'Da Vinci Trading',
    tests: 'Mental arithmetic and probability.',
    drills: ['blitz', 'probability'] },
  { firm: 'Citadel / Citadel Securities',
    tests: 'HackerRank coding (roughly LeetCode medium) plus probability, statistics and linear algebra; 60-90 minutes.',
    drills: ['probability', 'brainteaser'] },
  { firm: 'Two Sigma',
    tests: 'Coding and statistics/machine learning, ~90 minutes.',
    drills: ['probability'] },
  { firm: 'G-Research',
    tests: 'Mathematics and Python, ~60 minutes, including proof-flavoured questions.',
    drills: ['probability', 'brainteaser'] },
];
