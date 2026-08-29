import type { AppState, EnergyMode, Task, TaskCategory, PillarId } from '../models';
import { weekForIndex } from '../data/curriculum';
import { weekIndexFrom, monthIndexFrom, dayOfWeek, seededRandom, daysBetween } from '../lib/date';
import { dueForReview, srsActionFor } from './spacedRepetition';
import { recentCompletionRate } from './profile';

export const ENERGY_BUDGET: Record<EnergyMode, number> = {
  low: 55, // minimum viable
  min: 55,
  normal: 110,
  high: 180,
};

export const ENERGY_LABEL: Record<EnergyMode, string> = {
  low: 'Low energy — minimum viable day (45-60 min)',
  min: 'Minimum day (45-60 min)',
  normal: 'Normal day (90-120 min)',
  high: 'High-energy day (up to 3 hours)',
};

interface Spec {
  pillar: PillarId;
  category: TaskCategory;
  title: string;
  why: string;
  minutes: number;
  resourceId?: string;
  resourceHint?: string;
  output: string;
  priority: 'core' | 'optional';
}

const LEETCODE_PATTERNS = [
  'arrays', 'hash maps', 'strings', 'two pointers', 'sliding window',
  'binary search', 'stacks', 'queues', 'heaps', 'trees', 'graphs', 'dynamic programming',
];

function leetcodePattern(monthIdx: number, rnd: () => number): string {
  // Progress the difficulty of patterns with the month.
  const maxIdx = Math.min(LEETCODE_PATTERNS.length, 3 + monthIdx);
  const i = Math.floor(rnd() * maxIdx);
  return LEETCODE_PATTERNS[i];
}

// Build the day's base template from the weekday + current curriculum week.
function baseTemplate(dateISO: string, weekIdx: number): Spec[] {
  const dow = dayOfWeek(dateISO);
  const cw = weekForIndex(weekIdx);
  const monthIdx = monthIndexFrom(weekIdx);
  const rnd = seededRandom(dateISO);
  const topic = cw.topics[Math.floor(rnd() * cw.topics.length)] ?? cw.topics[0];

  const markets: Spec = {
    pillar: 'finance',
    category: 'markets',
    title: 'Markets Today — read 3 stories + analyse',
    why: 'Daily market awareness compounds; you learn to read cause→effect across assets.',
    minutes: 30,
    resourceId: 'reuters',
    output: 'Add 1 Market Journal entry (event, assets, your explanation, what to monitor).',
    priority: 'core',
  };
  const financeHull: Spec = {
    pillar: 'finance',
    category: 'finance',
    title: `Hull — ${topic}`,
    why: `Builds your derivatives foundation this week: ${cw.learningGoal}.`,
    minutes: 30,
    resourceId: 'hull',
    resourceHint: 'Hull — see Roadmap chapter for this week',
    output: cw.outputGoal,
    priority: 'core',
  };

  const aiTask: Spec = {
    pillar: 'ai',
    category: 'ai',
    title: `AI/ML — ${topic}`,
    why: 'Research-level ML understanding is core to your AI×quant direction.',
    minutes: 45,
    resourceId: monthIdx >= 7 ? 'sutton-barto' : 'cs229',
    output: cw.outputGoal,
    priority: 'core',
  };

  const research: Spec = {
    pillar: 'research',
    category: 'research',
    title: 'Paper reading with the 10-point template',
    why: 'Reading→critique turns consumption into research skill. Never just "read".',
    minutes: 30,
    resourceId: 'arxiv',
    output: 'Fill the 10-point paper template (question→follow-up) in Research.',
    priority: 'core',
  };

  const leetcode = (): Spec => {
    const pat = leetcodePattern(monthIdx, rnd);
    return {
      pillar: 'programming',
      category: 'technical',
      title: `LeetCode — ${pat}`,
      why: 'Optimise for understanding, not count. 1-2 quality problems.',
      minutes: 45,
      resourceId: 'neetcode',
      output: `Solve 1-2 ${pat} problems and write a 3-line explanation of each.`,
      priority: 'core',
    };
  };

  const pythonTask: Spec = {
    pillar: 'programming',
    category: 'technical',
    title: `Python — ${cw.topics.includes('pandas rolling') ? 'pandas rolling calculations' : 'implement toward this week’s output'}`,
    why: 'Turn learning into code you can reuse in projects.',
    minutes: 45,
    resourceId: 'pandas',
    output: cw.outputGoal,
    priority: 'core',
  };

  const career: Spec = {
    pillar: 'career',
    category: 'career',
    title: 'Career action — ' + cw.careerGoal,
    why: 'One meaningful (non-spam) networking/career action per week raises your win-rate.',
    minutes: 20,
    output: 'Log the action in Career (contact/application/experiment).',
    priority: 'optional',
  };

  const outputTask: Spec = {
    pillar: cw.primaryPillar,
    category: 'output',
    title: 'This week’s output — ' + cw.outputGoal,
    why: 'Output > consumption. Every week must produce something tangible.',
    minutes: 45,
    output: cw.outputGoal,
    priority: 'core',
  };

  switch (dow) {
    case 1: // Monday — technical + finance
      return [markets, pythonTask, financeHull, outputTask];
    case 2: // Tuesday — LeetCode + finance
      return [markets, leetcode(), financeHull];
    case 3: // Wednesday — AI + research
      return [markets, aiTask, research];
    case 4: // Thursday — technical + finance (Black-Scholes heavy)
      return [markets, { ...pythonTask, resourceId: 'scipy', title: 'Python — NumPy/SciPy numerical methods' }, { ...financeHull, minutes: 45 }];
    case 5: // Friday — research + career
      return [markets, { ...research, minutes: 45 }, career];
    case 6: // Saturday — deep work
      return [
        { ...markets, minutes: 15, title: 'Markets — weekend deep read', resourceId: 'ft' },
        { ...financeHull, minutes: 60, priority: 'core' },
        { ...outputTask, minutes: 60, title: 'Deep work — ' + cw.outputGoal },
      ];
    case 0: // Sunday — review + planning
      return [
        { pillar: 'research', category: 'review', title: 'Weekly Review (13 questions)', why: 'Reflection turns activity into compounding learning.', minutes: 30, output: 'Complete this week’s review in Reviews and set next week’s #1 output.', priority: 'core' },
        { pillar: 'career', category: 'career', title: 'Career exploration & planning', why: 'Explore which path (quant/AI/research) fits — keep the distribution wide.', minutes: 30, output: 'Update a Career Experiment: what did you learn about the path?', priority: 'optional' },
      ];
    default:
      return [markets, financeHull];
  }
}

function specToTask(dateISO: string, s: Spec, idx: number): Task {
  return {
    id: `gen-${dateISO}-${idx}`,
    date: dateISO,
    pillar: s.pillar,
    category: s.category,
    title: s.title,
    why: s.why,
    minutes: s.minutes,
    resourceId: s.resourceId,
    resourceHint: s.resourceHint,
    output: s.output,
    priority: s.priority,
    status: 'pending',
    generated: true,
  };
}

export interface GenerationContext {
  notes: string[];
}

// Generate the adaptive task list for a given date.
export function generateTasks(
  state: AppState,
  dateISO: string,
  energy: EnergyMode
): { tasks: Task[]; notes: string[] } {
  const notes: string[] = [];
  const weekIdx = weekIndexFrom(state.startDate, dateISO);
  const monthIdx = monthIndexFrom(weekIdx);
  let budget = ENERGY_BUDGET[energy];

  let specs = baseTemplate(dateISO, weekIdx);

  // --- Adaptive: upcoming deadlines within 7 days → cut optionals, reduce budget ---
  const upcoming = state.deadlines.filter((d) => {
    const diff = daysBetween(dateISO, d.date);
    return diff >= 0 && diff <= 7;
  });
  if (upcoming.length > 0) {
    specs = specs.filter((s) => s.priority === 'core');
    budget = Math.min(budget, 75);
    notes.push(`Deadline approaching (${upcoming[0].title}) — trimmed optional tasks and reduced today's load.`);
  }

  // --- Adaptive: weakest pillar boost ---
  const weakest = [...state.pillars].sort((a, b) => a.score - b.score)[0];
  if (weakest && dayOfWeek(dateISO) !== 0 && upcoming.length === 0) {
    const hasWeak = specs.some((s) => s.pillar === weakest.id);
    if (!hasWeak) {
      specs.push({
        pillar: weakest.id,
        category: weakest.id === 'career' ? 'career' : weakest.id === 'research' ? 'research' : 'finance',
        title: `Boost weakest pillar — ${weakest.name}`,
        why: `${weakest.name} is your lowest capability (${weakest.score}%). Extra reps here have the highest ROI.`,
        minutes: 20,
        output: `Do one focused ${weakest.name} activity and note progress.`,
        priority: 'optional',
      });
      notes.push(`Weakest pillar this week: ${weakest.name} — added a focused booster task.`);
    }
  }

  // --- Adaptive: difficulty scaling by recent completion ---
  const rate = recentCompletionRate(state, dateISO, 7);
  if (rate > 0.85) {
    notes.push('You have been completing >85% of tasks — nudging difficulty/time up slightly.');
    specs = specs.map((s) => (s.priority === 'core' ? { ...s, minutes: Math.round(s.minutes * 1.1) } : s));
  } else if (rate < 0.4) {
    notes.push('Completion has been low — reducing load to something realistic. Consistency first.');
    specs = specs.filter((s) => s.priority === 'core').slice(0, 3).map((s) => ({ ...s, minutes: Math.round(s.minutes * 0.85) }));
    budget = Math.min(budget, 70);
  }

  // --- Trim to budget (keep core first) ---
  specs.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'core' ? -1 : 1));
  const chosen: Spec[] = [];
  let used = 0;
  for (const s of specs) {
    if (used + s.minutes <= budget || (s.priority === 'core' && chosen.length < 2)) {
      chosen.push(s);
      used += s.minutes;
    }
  }

  const tasks = chosen.map((s, i) => specToTask(dateISO, s, i));

  // --- Inject due spaced-repetition reviews ---
  const due = dueForReview(state.knowledge, dateISO).slice(0, 2);
  due.forEach((e) => {
    tasks.push({
      id: `srs-${dateISO}-${e.id}`,
      date: dateISO,
      pillar: e.category.toLowerCase().includes('finance') ? 'finance' : e.category.toLowerCase().includes('ai') ? 'ai' : 'research',
      category: 'review',
      title: `Spaced review — ${e.concept}`,
      why: `Spaced repetition locks in ${e.concept}. Action: ${srsActionFor(e)}.`,
      minutes: 10,
      output: `${srsActionFor(e)} — then mark remembered/forgot in Knowledge.`,
      priority: 'optional',
      status: 'pending',
      generated: true,
    });
  });

  if (monthIdx <= 12) {
    notes.unshift(`Program week ${weekIdx} · Month ${monthIdx}: ${weekForIndex(weekIdx).learningGoal}`);
  }

  return { tasks, notes };
}
