import type { AppState, EnergyMode, FeedItem, Task, TaskCategory, PillarId } from '../models';
import { DEFAULT_SCHEDULE } from '../models';
import { weekForIndex } from '../data/curriculum';
import { weekIndexFrom, monthIndexFrom, dayOfWeek, seededRandom, daysBetween } from '../lib/date';
import { dueForReview, srsActionFor } from './spacedRepetition';
import { recentCompletionRate } from './profile';
import { assignTimes, freeSlots, isCampusDay } from './scheduler';

export const ENERGY_BUDGET: Record<EnergyMode, number> = {
  low: 45, // minimum viable day
  min: 45,
  normal: 120,
  high: 180,
};

export const ENERGY_LABEL: Record<EnergyMode, string> = {
  low: 'Minimum day — one core task only (≈45 min)',
  min: 'Minimum day — one core task only (≈45 min)',
  normal: 'Normal day — 2 core + 1 optional (≈2 hours)',
  high: 'Big day — 3 core + 1 optional (≈3 hours)',
};

/** How much the day is allowed to ask of you, per energy mode. */
const ENERGY_CAPS: Record<EnergyMode, { core: number; optional: number }> = {
  low: { core: 1, optional: 1 },
  min: { core: 1, optional: 1 },
  normal: { core: 2, optional: 1 },
  high: { core: 3, optional: 1 },
};

interface Spec {
  pillar: PillarId;
  category: TaskCategory;
  title: string;
  why: string;
  minutes: number;
  resourceId?: string;
  resourceHint?: string;
  url?: string;
  output: string;
  priority: 'core' | 'optional';
  location?: 'anywhere' | 'campus';
  prefer?: 'morning' | 'midday' | 'evening';
}

const LEETCODE_PATTERNS = [
  'arrays', 'hash maps', 'strings', 'two pointers', 'sliding window',
  'binary search', 'stacks', 'queues', 'heaps', 'trees', 'graphs', 'dynamic programming',
];

function leetcodePattern(monthIdx: number, rnd: () => number): string {
  const maxIdx = Math.min(LEETCODE_PATTERNS.length, 3 + monthIdx);
  return LEETCODE_PATTERNS[Math.floor(rnd() * maxIdx)];
}

// ---------------------------------------------------------------- core blocks

/** Daily market input — the one habit that must never break. */
function marketsInput(dateISO: string, onCampus: boolean, feed: FeedItem[]): Spec {
  const dow = dayOfWeek(dateISO);
  const rnd = seededRandom(dateISO + 'markets');

  // Prefer an actual queued item if one is sitting in the inbox.
  const queued = feed.find((f) => f.status === 'inbox' && (!f.needsCampus || onCampus));
  if (queued) {
    return {
      pillar: queued.pillar,
      category: 'markets',
      title: `${labelForType(queued.type)} — ${queued.title}`,
      why: 'You saved this for a reason. Clearing one item a day keeps the inbox honest.',
      minutes: queued.estMinutes,
      url: queued.url,
      output: 'Write 2-3 lines: what was the claim, what was the evidence, what do you disagree with?',
      priority: 'core',
      location: queued.needsCampus ? 'campus' : 'anywhere',
      prefer: queued.type === 'podcast' ? 'midday' : 'morning',
    };
  }

  // Weekday rhythm keeps the inputs varied instead of always being news.
  switch (dow) {
    case 2:
    case 4:
      return {
        pillar: 'finance',
        category: 'markets',
        title: 'Quartr — earnings call deep dive (30 min)',
        why: 'Primary-source company research. Earnings language is what interviewers expect you to speak.',
        minutes: 30,
        resourceId: 'quartr',
        output: 'One company: guidance vs results, what management avoided, one follow-up question.',
        priority: 'core',
        prefer: 'morning',
      };
    case 3:
      return {
        pillar: 'finance',
        category: 'markets',
        title: 'Podcast / Substack — one long-form piece',
        why: 'Long-form builds the mental models that daily headlines never will.',
        minutes: 30,
        resourceId: rnd() > 0.5 ? 'tom' : 'odd-lots',
        output: 'Note the single most counter-intuitive claim and whether you believe it.',
        priority: 'core',
        prefer: 'midday',
      };
    case 6:
      return {
        pillar: 'finance',
        category: 'markets',
        title: 'Weekend deep read — build one macro view',
        why: 'Weekends are for the slow thinking that weekdays never allow.',
        minutes: 45,
        resourceId: 'ft',
        output: 'Write a short thesis: what you think happens next, and what would prove you wrong.',
        priority: 'core',
        prefer: 'morning',
      };
    default:
      return {
        pillar: 'finance',
        category: 'markets',
        title: 'Markets Today — 3 stories + one causal chain',
        why: 'Daily market awareness compounds; you learn to read cause→effect across assets.',
        minutes: 25,
        resourceId: 'reuters',
        output: 'One Market Journal entry: event → assets → your explanation → what to monitor.',
        priority: 'core',
        prefer: 'morning',
      };
  }
}

function labelForType(t: FeedItem['type']): string {
  switch (t) {
    case 'podcast': return 'Podcast';
    case 'substack': return 'Read';
    case 'earnings': return 'Quartr';
    case 'paper': return 'Paper';
    case 'video': return 'Video';
    case 'terminal': return 'Terminal';
    default: return 'News';
  }
}

/** The deep-work block — always tied to a real project milestone. */
function buildBlock(state: AppState, dateISO: string, minutes: number): Spec {
  const cw = weekForIndex(weekIndexFrom(state.startDate, dateISO));
  const active =
    state.projects.find((p) => p.status === 'active') ??
    state.projects.find((p) => p.status === 'backlog');
  const nextMs = active?.milestones.find((m) => !m.done);

  if (active && nextMs) {
    return {
      pillar: active.pillars[0] ?? 'finance',
      category: 'output',
      title: `Build — ${active.name}: ${nextMs.title}`,
      why: 'Output > consumption. One milestone a session is how a project actually ships.',
      minutes,
      resourceId: 'git',
      resourceHint: `Project: ${active.name}`,
      output: nextMs.title + ' — tick it off in Projects when done.',
      priority: 'core',
      // Deep work lands in the afternoon gap between commitments — the most
      // reliable window in a student day, rather than after a late shift.
      prefer: 'midday',
    };
  }

  return {
    pillar: cw.primaryPillar,
    category: 'output',
    title: 'This week’s output — ' + cw.outputGoal,
    why: 'Output > consumption. Every week must produce something tangible.',
    minutes,
    output: cw.outputGoal,
    priority: 'core',
    prefer: 'midday',
  };
}

// ------------------------------------------------------------ optional blocks

function drillBlock(state: AppState, dateISO: string): Spec {
  const progress = Object.values(state.cardProgress ?? {});
  const deckSize = state.deckSize ?? 0;
  const due = progress.filter((c) => c.nextReview && c.nextReview <= dateISO).length;
  const fresh = deckSize - progress.length;
  return {
    pillar: 'career',
    category: 'review',
    title: 'Interview drill — 8 flashcards',
    why: deckSize === 0
      ? 'Open Knowledge once to load the interview deck, then drill daily.'
      : `Technical interviews are a recall sport. ${fresh > 0 ? `${fresh} unseen, ` : ''}${due} due for review.`,
    minutes: 12,
    output: 'Run the drill in Knowledge. Anything you miss goes back in the queue.',
    priority: 'optional',
    prefer: 'morning',
  };
}

function terminalBlock(): Spec {
  return {
    pillar: 'finance',
    category: 'finance',
    title: 'Bloomberg Terminal — one function, learned properly',
    why: 'Terminal fluency is a cheap differentiator — most students never touch it.',
    minutes: 25,
    resourceId: 'bloomberg-bquant',
    output: 'Write down the mnemonic + one thing you pulled that you could not get elsewhere.',
    priority: 'optional',
    location: 'campus',
    prefer: 'midday',
  };
}

function leetcodeBlock(monthIdx: number, rnd: () => number): Spec {
  const pat = leetcodePattern(monthIdx, rnd);
  return {
    pillar: 'programming',
    category: 'technical',
    title: `LeetCode — ${pat} (2 problems)`,
    why: 'Optimise for understanding, not count.',
    minutes: 35,
    resourceId: 'neetcode',
    output: `Solve 2 ${pat} problems; write a 3-line explanation of the pattern.`,
    priority: 'optional',
    prefer: 'midday',
  };
}

function weeklyReviewBlock(): Spec {
  return {
    pillar: 'research',
    category: 'review',
    title: 'Weekly Review (13 questions)',
    why: 'Reflection turns activity into compounding learning.',
    minutes: 25,
    output: 'Complete this week’s review in Reviews and set next week’s #1 output.',
    priority: 'core',
    prefer: 'evening',
  };
}

function planningBlock(): Spec {
  return {
    pillar: 'career',
    category: 'career',
    title: 'Plan next week + one career action',
    why: 'Looking up once a week is how you avoid drifting for a month.',
    minutes: 25,
    output: 'Clear the Inbox, confirm next week’s project milestone, log one career action.',
    priority: 'core',
    prefer: 'morning',
  };
}

// ------------------------------------------------------------------ assemble

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
    url: s.url,
    output: s.output,
    priority: s.priority,
    status: 'pending',
    generated: true,
    location: s.location ?? 'anywhere',
    prefer: s.prefer,
  };
}

export interface GenerationContext {
  notes: string[];
}

export function generateTasks(
  state: AppState,
  dateISO: string,
  energy: EnergyMode
): { tasks: Task[]; notes: string[] } {
  const notes: string[] = [];
  const settings = state.schedule ?? DEFAULT_SCHEDULE;
  const weekIdx = weekIndexFrom(state.startDate, dateISO);
  const monthIdx = monthIndexFrom(weekIdx);
  const rnd = seededRandom(dateISO);
  const dow = dayOfWeek(dateISO);
  const onCampus = isCampusDay(settings, dateISO);
  const cw = weekForIndex(weekIdx);

  const caps = ENERGY_CAPS[energy] ?? ENERGY_CAPS.normal;
  // The schedule caps are your default. Choosing "big day" earns one extra core
  // task; "minimum day" overrides the default entirely.
  const defaultCore = settings.maxCoreTasks || caps.core;
  const maxCore = energy === 'high'
    ? Math.min(caps.core, defaultCore + 1)
    : Math.min(caps.core, defaultCore);
  const maxOptional = energy === 'high'
    ? Math.min(caps.optional, (settings.maxOptionalTasks ?? caps.optional) + 1)
    : Math.min(caps.optional, settings.maxOptionalTasks ?? caps.optional);

  const { slots, freeMinutes } = freeSlots(state.fixedBlocks ?? [], settings, dateISO);
  let budget = ENERGY_BUDGET[energy] ?? 120;

  if (freeMinutes > 0) {
    // Leave ~15% of free time as slack — a fully packed day is a fragile day.
    budget = Math.min(budget, Math.max(30, Math.floor(freeMinutes * 0.85)));
    if (Math.floor(freeMinutes * 0.85) < budget) {
      notes.push(`Only ${Math.round(freeMinutes / 60 * 10) / 10}h free today — plan trimmed to fit your calendar.`);
    }
  }

  // --- Build the candidate menu -------------------------------------------
  let cores: Spec[] = [];
  let optionals: Spec[] = [];

  if (dow === 0) {
    cores = [planningBlock(), weeklyReviewBlock()];
    optionals = [drillBlock(state, dateISO)];
  } else {
    cores = [marketsInput(dateISO, onCampus, state.feed ?? []), buildBlock(state, dateISO, dow === 6 ? 75 : 50)];
    optionals = [drillBlock(state, dateISO), leetcodeBlock(monthIdx, rnd)];
    if (onCampus) optionals.push(terminalBlock());
  }

  // --- Adaptive: deadlines within 7 days ----------------------------------
  const upcoming = (state.deadlines ?? []).filter((d) => {
    const diff = daysBetween(dateISO, d.date);
    return diff >= 0 && diff <= 7;
  });
  if (upcoming.length > 0) {
    optionals = [];
    budget = Math.min(budget, 75);
    notes.push(`Deadline approaching (${upcoming[0].title}) — optional tasks dropped, load reduced.`);
  }

  // --- Adaptive: weakest pillar boost -------------------------------------
  const weakest = [...state.pillars].sort((a, b) => a.score - b.score)[0];
  if (weakest && dow !== 0 && upcoming.length === 0 && maxOptional > optionals.length) {
    optionals.push({
      pillar: weakest.id,
      category: weakest.id === 'career' ? 'career' : weakest.id === 'research' ? 'research' : 'finance',
      title: `Boost weakest pillar — ${weakest.name}`,
      why: `${weakest.name} is your lowest capability (${weakest.score}%). Extra reps here have the highest ROI.`,
      minutes: 20,
      output: `Do one focused ${weakest.name} activity and note progress.`,
      priority: 'optional',
      prefer: 'midday',
    });
    notes.push(`Weakest pillar: ${weakest.name} — added a short booster task.`);
  }

  // --- Adaptive: scale with recent completion ------------------------------
  const rate = recentCompletionRate(state, dateISO, 7);
  if (rate !== null && rate > 0.85) {
    notes.push('You have been completing >85% of tasks — nudging the workload up slightly.');
    cores = cores.map((s) => ({ ...s, minutes: Math.round(s.minutes * 1.1) }));
  } else if (rate !== null && rate < 0.4) {
    notes.push('Completion has been low — cutting back to something you can actually finish.');
    cores = cores.slice(0, 1).map((s) => ({ ...s, minutes: Math.round(s.minutes * 0.85) }));
    optionals = optionals.slice(0, 1);
    budget = Math.min(budget, 70);
  }

  // --- Choose within caps, then within the time budget ---------------------
  const chosenCores = cores.slice(0, Math.max(1, maxCore));

  // On a big day, promote optional work into core so the extra capacity is
  // actually used rather than silently ignored.
  while (chosenCores.length < maxCore) {
    const nextIdx = optionals.findIndex((s) => !(s.location === 'campus' && !onCampus));
    if (nextIdx < 0) break;
    const [next] = optionals.splice(nextIdx, 1);
    chosenCores.push({ ...next, priority: 'core' });
  }

  const chosenOptionals: Spec[] = [];
  let used = chosenCores.reduce((a, s) => a + s.minutes, 0);
  for (const s of optionals) {
    if (chosenOptionals.length >= maxOptional) break;
    if (s.location === 'campus' && !onCampus) continue;
    if (used + s.minutes <= budget + 15) {
      chosenOptionals.push(s);
      used += s.minutes;
    }
  }

  const specs = [...chosenCores, ...chosenOptionals];
  const tasks = specs.map((s, i) => specToTask(dateISO, s, i));

  // --- Inject due spaced-repetition concept reviews -------------------------
  const due = dueForReview(state.knowledge, dateISO).slice(0, 2);
  due.forEach((e) => {
    tasks.push({
      id: `srs-${dateISO}-${e.id}`,
      date: dateISO,
      pillar: e.category.toLowerCase().includes('finance')
        ? 'finance'
        : e.category.toLowerCase().includes('ai')
          ? 'ai'
          : 'research',
      category: 'review',
      title: `Spaced review — ${e.concept}`,
      why: `Spaced repetition locks in ${e.concept}. Action: ${srsActionFor(e)}.`,
      minutes: 10,
      output: `${srsActionFor(e)} — then mark remembered/forgot in Knowledge.`,
      priority: 'optional',
      status: 'pending',
      generated: true,
      prefer: 'morning',
    });
  });

  // --- Assign concrete start times ----------------------------------------
  const scheduled = settings.autoSchedule ? assignTimes(tasks, slots) : tasks;
  const unplaced = scheduled.filter((t) => !t.startTime && t.priority === 'core');
  if (unplaced.length > 0 && slots.length > 0) {
    notes.push('Some tasks could not find a free slot — your calendar is tight today.');
  }

  if (monthIdx <= 12) {
    notes.unshift(`Program week ${weekIdx} · Month ${monthIdx}: ${cw.learningGoal}`);
  }
  if (onCampus) {
    notes.push("You're on campus today — a Bloomberg terminal task is available.");
  }

  return { tasks: scheduled, notes };
}

/** Re-place existing tasks into the day's free slots (content untouched). */
export function scheduleExisting(state: AppState, dateISO: string, tasks: Task[]): Task[] {
  const settings = state.schedule ?? DEFAULT_SCHEDULE;
  if (!settings.autoSchedule) return tasks;
  const { slots } = freeSlots(state.fixedBlocks ?? [], settings, dateISO);
  return assignTimes(tasks, slots);
}
