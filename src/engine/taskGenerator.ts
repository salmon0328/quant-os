import type { AppState, EnergyMode, FeedItem, Task, TaskCategory, PillarId } from '../models';
import { DEFAULT_SCHEDULE } from '../models';
import { weekForIndex } from '../data/curriculum';
import { weekIndexFrom, dayOfWeek, daysBetween } from '../lib/date';
import { dueForReview, srsActionFor } from './spacedRepetition';
import { recentCompletionRate } from './profile';
import { assignTimes, freeSlots, isCampusDay } from './scheduler';
import { TASK_KIND_BY_ID, minutesFor, type TaskKind, type TaskKindId } from '../data/cadence';

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
  kind: TaskKindId;
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
  micro?: boolean;
  rank: number;
}

const LEETCODE_PATTERNS = [
  'arrays', 'hash maps', 'strings', 'two pointers', 'sliding window',
  'binary search', 'stacks', 'queues', 'heaps', 'trees', 'graphs', 'dynamic programming',
];

/**
 * Patterns advance by week rather than being drawn at random, so the same
 * pattern never reappears two sessions in a row and progress is visible.
 */
function leetcodePattern(weekIdx: number): string {
  return LEETCODE_PATTERNS[Math.max(0, weekIdx - 1) % LEETCODE_PATTERNS.length];
}

// -------------------------------------------------------------------- inputs

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

/** The oldest queued item wins, so the queue drains in the order it filled. */
function nextQueued(feed: FeedItem[], onCampus: boolean): FeedItem | undefined {
  return feed
    .filter((f) => f.status === 'inbox' && (!f.needsCampus || onCampus))
    .slice()
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))[0];
}

// ------------------------------------------------------------------- builders

function marketsSpec(minutes: number): Spec {
  return {
    kind: 'markets',
    pillar: 'finance',
    category: 'markets',
    title: 'Markets Today — 3 stories + one causal chain',
    why: 'Daily market awareness compounds; you learn to read cause→effect across assets.',
    minutes,
    resourceId: 'reuters',
    output: 'One Market Journal entry: event → assets → explanation → what to monitor.',
    priority: 'core',
    prefer: 'morning',
    rank: TASK_KIND_BY_ID.get('markets')!.rank,
  };
}

function buildSpec(state: AppState, minutes: number): Spec {
  const active =
    state.projects.find((p) => p.status === 'active') ??
    state.projects.find((p) => p.status === 'backlog');
  const nextMs = active?.milestones.find((m) => !m.done);

  if (active && nextMs) {
    return {
      kind: 'build',
      pillar: active.pillars[0] ?? 'finance',
      category: 'output',
      title: `Build — ${active.name}: ${nextMs.title}`,
      why: 'Output > consumption. One long block is how a project actually ships.',
      minutes,
      resourceId: 'git',
      resourceHint: `Project: ${active.name}`,
      output: nextMs.title + ' — tick it off in Projects when done.',
      priority: 'core',
      prefer: 'midday',
      rank: TASK_KIND_BY_ID.get('build')!.rank,
    };
  }

  const cw = weekForIndex(weekIndexFrom(state.startDate, new Date().toISOString().slice(0, 10)));
  return {
    kind: 'build',
    pillar: cw.primaryPillar,
    category: 'output',
    title: 'This week’s output — ' + cw.outputGoal,
    why: 'Output > consumption. Every week must produce something tangible.',
    minutes,
    output: cw.outputGoal,
    priority: 'core',
    prefer: 'midday',
    rank: TASK_KIND_BY_ID.get('build')!.rank,
  };
}

function codingSpec(weekIdx: number, minutes: number): Spec {
  const pat = leetcodePattern(weekIdx);
  return {
    kind: 'coding',
    pillar: 'programming',
    category: 'technical',
    title: `LeetCode — ${pat} (2 problems)`,
    why: 'Optimise for understanding, not count.',
    minutes,
    resourceId: 'neetcode',
    output: `Solve 2 ${pat} problems; write a 3-line explanation of the pattern.`,
    priority: 'core',
    prefer: 'midday',
    rank: TASK_KIND_BY_ID.get('coding')!.rank,
  };
}

/** Deep input prefers a real queued item; otherwise it names a rotation. */
function deepInputSpec(feed: FeedItem[], onCampus: boolean, minutes: number): Spec {
  const queued = nextQueued(feed, onCampus);
  if (queued) {
    return {
      kind: 'deepInput',
      pillar: queued.pillar,
      category: 'markets',
      title: `${labelForType(queued.type)} — ${queued.title}`,
      why: 'You saved this for a reason. Clearing one item a day keeps the inbox honest.',
      minutes: Math.max(minutes, queued.estMinutes),
      url: queued.url,
      output: 'Write 2-3 lines: what was the claim, what was the evidence, what do you disagree with?',
      priority: 'optional',
      location: queued.needsCampus ? 'campus' : 'anywhere',
      prefer: queued.type === 'podcast' ? 'midday' : 'morning',
      rank: TASK_KIND_BY_ID.get('deepInput')!.rank,
    };
  }
  return {
    kind: 'deepInput',
    pillar: 'finance',
    category: 'markets',
    title: 'Quartr — earnings call deep dive',
    why: 'Primary-source company research. Earnings language is what interviewers expect.',
    minutes,
    resourceId: 'quartr',
    output: 'One company: guidance vs results, what management avoided, one follow-up question.',
    priority: 'optional',
    prefer: 'morning',
    rank: TASK_KIND_BY_ID.get('deepInput')!.rank,
  };
}

function drillSpec(state: AppState, dateISO: string, minutes: number): Spec {
  const progress = Object.values(state.cardProgress ?? {});
  const deckSize = state.deckSize ?? 0;
  const due = progress.filter((c) => c.nextReview && c.nextReview <= dateISO).length;
  const fresh = Math.max(0, deckSize - progress.length);
  return {
    kind: 'drill',
    pillar: 'career',
    category: 'review',
    title: 'Interview drill — 8 flashcards',
    why: deckSize === 0
      ? 'Open Knowledge once to load the interview deck, then drill daily.'
      : `Technical interviews are a recall sport. ${fresh > 0 ? `${fresh} unseen, ` : ''}${due} due.`,
    minutes,
    output: 'Run the drill in Knowledge. Anything you miss goes back in the queue.',
    priority: 'optional',
    micro: true,
    prefer: 'morning',
    rank: TASK_KIND_BY_ID.get('drill')!.rank,
  };
}

function terminalSpec(minutes: number): Spec {
  return {
    kind: 'terminal',
    pillar: 'finance',
    category: 'finance',
    title: 'Bloomberg Terminal — one function, learned properly',
    why: 'Terminal fluency is a cheap differentiator — most students never touch it.',
    minutes,
    resourceId: 'bloomberg-bquant',
    output: 'Write down the mnemonic + one thing you pulled that you could not get elsewhere.',
    priority: 'optional',
    location: 'campus',
    prefer: 'midday',
    rank: TASK_KIND_BY_ID.get('terminal')!.rank,
  };
}

function planningSpec(minutes: number): Spec {
  return {
    kind: 'planning',
    pillar: 'career',
    category: 'career',
    title: 'Plan next week + one career action',
    why: 'Looking up once a week is how you avoid drifting for a month.',
    minutes,
    output: 'Clear the Inbox, confirm next week’s project milestone, log one career action.',
    priority: 'core',
    prefer: 'morning',
    rank: TASK_KIND_BY_ID.get('planning')!.rank,
  };
}

function reviewSpec(minutes: number): Spec {
  return {
    kind: 'review',
    pillar: 'research',
    category: 'review',
    title: 'Weekly Review (13 questions)',
    why: 'Reflection turns activity into compounding learning.',
    minutes,
    output: 'Complete this week’s review in Reviews and set next week’s #1 output.',
    priority: 'core',
    prefer: 'morning',
    rank: TASK_KIND_BY_ID.get('review')!.rank,
  };
}

// ------------------------------------------------------------------ assemble

function specToTask(dateISO: string, s: Spec): Task {
  return {
    id: `${s.kind}-${dateISO}`,
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
    // Stable id: a cadence task keeps the same id across regenerations, so
    // completing it once isn't undone by re-running the generator.
  };
}

/** Which weekdays a kind lands on, falling back to its default. */
function cadenceFor(state: AppState, kind: TaskKind): number[] {
  const custom = state.schedule?.cadences?.[kind.id];
  return custom && custom.length > 0 ? custom : kind.defaultDays;
}

export function generateTasks(
  state: AppState,
  dateISO: string,
  energy: EnergyMode
): { tasks: Task[]; notes: string[] } {
  const notes: string[] = [];
  const settings = state.schedule ?? DEFAULT_SCHEDULE;
  const weekIdx = weekIndexFrom(state.startDate, dateISO);
  const dow = dayOfWeek(dateISO);
  const onCampus = isCampusDay(settings, dateISO);
  const cw = weekForIndex(weekIdx);
  const feed = state.feed ?? [];

  const caps = ENERGY_CAPS[energy] ?? ENERGY_CAPS.normal;
  const defaultCore = settings.maxCoreTasks || caps.core;
  const maxCore = energy === 'high'
    ? Math.min(caps.core, defaultCore + 1)
    : Math.min(caps.core, defaultCore);
  const maxOptional = energy === 'high'
    ? Math.min(caps.optional, (settings.maxOptionalTasks ?? caps.optional) + 1)
    : Math.min(caps.optional, settings.maxOptionalTasks ?? caps.optional);

  const { slots, freeMinutes } = freeSlots(state.fixedBlocks, settings, dateISO);
  let budget = ENERGY_BUDGET[energy] ?? 120;
  if (freeMinutes > 0) {
    budget = Math.min(budget, Math.max(30, Math.floor(freeMinutes * 0.85)));
    if (Math.floor(freeMinutes * 0.85) < budget) {
      notes.push(`Only ${Math.round((freeMinutes / 60) * 10) / 10}h free today — plan trimmed to fit your calendar.`);
    }
  }

  // ---------------------------------------------------------------- deadline
  const upcoming = (state.deadlines ?? []).filter((d) => {
    const diff = daysBetween(dateISO, d.date);
    return diff >= 0 && diff <= 7;
  });
  if (upcoming.length > 0) {
    notes.push(`Deadline approaching (${upcoming[0].title}) — optional tasks dropped, load reduced.`);
  }

  // --------------------------------------------- candidates from the rhythm
  const onDay = (kind: TaskKind) => cadenceFor(state, kind).includes(dow);
  const mins = (kind: TaskKind) => minutesFor(kind, dow);

  const candidates: Spec[] = [];

  const markets = TASK_KIND_BY_ID.get('markets')!;
  if (onDay(markets)) candidates.push(marketsSpec(mins(markets)));

  const planning = TASK_KIND_BY_ID.get('planning')!;
  if (onDay(planning)) candidates.push(planningSpec(mins(planning)));

  const review = TASK_KIND_BY_ID.get('review')!;
  if (onDay(review)) candidates.push(reviewSpec(mins(review)));

  const build = TASK_KIND_BY_ID.get('build')!;
  if (onDay(build)) candidates.push(buildSpec(state, mins(build)));

  const coding = TASK_KIND_BY_ID.get('coding')!;
  if (onDay(coding)) candidates.push(codingSpec(weekIdx, mins(coding)));

  const deepInput = TASK_KIND_BY_ID.get('deepInput')!;
  if (onDay(deepInput)) candidates.push(deepInputSpec(feed, onCampus, mins(deepInput)));

  const drill = TASK_KIND_BY_ID.get('drill')!;
  if (onDay(drill)) candidates.push(drillSpec(state, dateISO, mins(drill)));

  const terminal = TASK_KIND_BY_ID.get('terminal')!;
  if (onDay(terminal) && onCampus) candidates.push(terminalSpec(mins(terminal)));

  // ----------------------------------------------- fill an empty core slot
  // Weekdays with no rotation task would otherwise be nearly empty. Rather than
  // inventing random work, drain the inbox the user already filled.
  const coreCount = candidates.filter((c) => c.priority === 'core').length;
  if (coreCount < maxCore && dow !== 0 && upcoming.length === 0) {
    const queued = nextQueued(feed, onCampus);
    // Guard on url only when there is one: comparing undefined === undefined
    // would treat an un-linked item as already scheduled and skip it.
    const alreadyQueued = queued?.url
      ? candidates.some((c) => c.url === queued.url)
      : false;
    if (queued && !alreadyQueued) {
      candidates.push({
        kind: 'deepInput',
        pillar: queued.pillar,
        category: 'markets',
        title: `Clear inbox — ${queued.title}`,
        why: 'Your queue drains in the order you filled it, on days the rhythm leaves room.',
        minutes: Math.min(queued.estMinutes, 45),
        url: queued.url,
        output: 'Two lines: what it argued, and whether you buy it.',
        priority: 'core',
        location: queued.needsCampus ? 'campus' : 'anywhere',
        prefer: 'midday',
        rank: deepInput.rank,
      });
    }
  }

  // ------------------------------------------------------------- weakest pillar
  const weakest = [...state.pillars].sort((a, b) => a.score - b.score)[0];
  const canBoost = dow !== 0 && upcoming.length === 0;

  // --------------------------------------------------------------- selection
  const micros = candidates.filter((c) => c.micro);
  const rest = candidates.filter((c) => !c.micro).sort((a, b) => a.rank - b.rank);

  const chosenCores: Spec[] = [];
  const chosenOptionals: Spec[] = [];
  let used = 0;

  // Weekly admin is scheduled on its day whatever the cap says — one missed
  // review is a week of unexamined work, and it only happens once a week. It
  // also must not consume the slots the daily rhythm depends on, so the cap is
  // counted over the rhythm tasks only.
  const isAdmin = (s: Spec) => TASK_KIND_BY_ID.get(s.kind)?.admin === true;
  for (const s of rest.filter((c) => c.priority === 'core' && isAdmin(c))) {
    if (s.location === 'campus' && !onCampus) continue;
    chosenCores.push(s);
    used += s.minutes;
  }

  // Remaining core slots, by rank, while slots and budget allow.
  let rhythmCores = 0;
  for (const s of rest.filter((c) => c.priority === 'core' && !isAdmin(c))) {
    if (rhythmCores >= maxCore) break;
    if (s.location === 'campus' && !onCampus) continue;
    chosenCores.push(s);
    rhythmCores += 1;
    used += s.minutes;
  }
  // Micro tasks ride along — they never lose to a longer task.
  micros.forEach((s) => { used += s.minutes; });

  if (upcoming.length === 0) {
    const optionals = rest.filter((c) => c.priority === 'optional');
    for (const s of optionals) {
      if (chosenOptionals.length >= maxOptional) break;
      if (s.location === 'campus' && !onCampus) continue;
      if (used + s.minutes <= budget + 15) {
        chosenOptionals.push(s);
        used += s.minutes;
      }
    }
    // A big day promotes optional work into core so the extra capacity is used.
    while (chosenCores.length < maxCore) {
      const next = optionals.find(
        (s) => !chosenOptionals.includes(s) && !chosenCores.includes(s) && !(s.location === 'campus' && !onCampus)
      );
      if (!next) break;
      chosenCores.push({ ...next, priority: 'core' });
      used += next.minutes;
    }
  }

  if (canBoost && weakest && chosenCores.length + chosenOptionals.length === 0) {
    notes.push(`Nothing on today’s rhythm — weakest pillar is ${weakest.name} if you want a rep.`);
  }

  // --------------------------------------------------- adaptive completion rate
  const rate = recentCompletionRate(state, dateISO, 7);
  if (rate !== null && rate > 0.85) {
    notes.push('You have been completing >85% of tasks — nudging the workload up slightly.');
  } else if (rate !== null && rate < 0.4) {
    notes.push('Completion has been low — cutting back to something you can actually finish.');
  }

  // Placement follows cadence rank regardless of tier: a 12-minute morning
  // habit must not be pushed to the afternoon just because it is optional.
  const specs = [...chosenCores, ...chosenOptionals, ...micros].sort((a, b) => a.rank - b.rank);
  const tasks = specs.map((s) => specToTask(dateISO, s));

  // ------------------------------------------------- spaced repetition inserts
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

  const scheduled = settings.autoSchedule ? assignTimes(tasks, slots) : tasks;
  const unplaced = scheduled.filter((t) => !t.startTime && t.priority === 'core');
  if (unplaced.length > 0 && slots.length > 0) {
    notes.push('Some tasks could not find a free slot — your calendar is tight today.');
  }

  notes.unshift(`Program week ${weekIdx} · ${cw.learningGoal}`);
  if (onCampus) {
    notes.push("You're on campus today — a Bloomberg terminal task is available.");
  }

  return { tasks: scheduled, notes };
}

/** Re-place existing tasks into the day's free slots (content untouched). */
export function scheduleExisting(state: AppState, dateISO: string, tasks: Task[]): Task[] {
  const settings = state.schedule ?? DEFAULT_SCHEDULE;
  if (!settings.autoSchedule) return tasks;
  const { slots } = freeSlots(state.fixedBlocks, settings, dateISO);
  return assignTimes(tasks, slots);
}
