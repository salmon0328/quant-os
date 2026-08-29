import type { PillarId, TaskCategory, TaskLocation, TaskPriority } from '../models';

/** Kinds of work the planner can schedule. Each has its own weekly rhythm. */
export type TaskKindId =
  | 'markets'
  | 'build'
  | 'coding'
  | 'deepInput'
  | 'drill'
  | 'terminal'
  | 'planning'
  | 'review';

export interface TaskKind {
  id: TaskKindId;
  label: string;
  pillar: PillarId;
  category: TaskCategory;
  /** Weekdays this lands on by default (0=Sun … 6=Sat). */
  defaultDays: number[];
  minutes: number;
  /** Longer session on weekends (0=Sun, 6=Sat); overrides `minutes`. */
  weekendMinutes?: number;
  priority: TaskPriority;
  /**
   * Micro tasks ride along without consuming a core/optional slot. Drill is
   * 12 minutes and depends on daily repetition to work, so it must not be
   * squeezed out by the longer rotation tasks.
   */
  micro?: boolean;
  location?: TaskLocation;
  prefer?: 'morning' | 'midday' | 'evening';
  /** Order used when several tasks compete for a limited slot. Lower wins. */
  rank: number;
  /**
   * Weekly admin (planning, review) is scheduled on its day regardless of the
   * core-task cap. It happens once a week and skipping it is what turns into
   * drifting for a month, so it must not lose a slot to a daily task.
   */
  admin?: boolean;
  description: string;
}

/**
 * Defaults reflect the chosen weekly rhythm: market news daily, project work
 * concentrated in one long weekend block, coding twice midweek, deep input on
 * the coding days plus a longer weekend read, and a short daily drill.
 */
export const TASK_KINDS: TaskKind[] = [
  {
    id: 'markets',
    label: 'Market news',
    pillar: 'finance',
    category: 'markets',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    minutes: 25,
    priority: 'core',
    rank: 0,
    prefer: 'morning',
    description: 'Daily market awareness. The one habit that never moves.',
  },
  {
    id: 'build',
    label: 'Project work',
    pillar: 'finance',
    category: 'output',
    // Saturday only: Sunday already carries planning + review, and a 2-3 hour
    // block on top of those would blow the day.
    defaultDays: [6],
    minutes: 90,
    weekendMinutes: 120,
    priority: 'core',
    rank: 1,
    prefer: 'midday',
    description: 'One long block to actually ship something.',
  },
  {
    id: 'coding',
    label: 'LeetCode',
    pillar: 'programming',
    category: 'technical',
    defaultDays: [2, 4],
    minutes: 35,
    priority: 'core',
    rank: 2,
    prefer: 'midday',
    description: 'Two problems per session, pattern-first.',
  },
  {
    id: 'deepInput',
    label: 'Deep input',
    pillar: 'finance',
    category: 'markets',
    defaultDays: [2, 4, 6],
    minutes: 30,
    weekendMinutes: 45,
    priority: 'optional',
    rank: 3,
    prefer: 'midday',
    description: 'Quartr earnings call, long podcast or long-form read.',
  },
  {
    id: 'drill',
    label: 'Flashcard drill',
    pillar: 'career',
    category: 'review',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    minutes: 12,
    priority: 'optional',
    micro: true,
    rank: 4,
    prefer: 'morning',
    description: 'Short daily recall practice. Spaced repetition needs frequency.',
  },
  {
    id: 'terminal',
    label: 'Bloomberg terminal',
    pillar: 'finance',
    category: 'finance',
    defaultDays: [1, 2, 3, 4, 5],
    minutes: 25,
    priority: 'optional',
    location: 'campus',
    rank: 5,
    prefer: 'midday',
    description: 'Only scheduled on days you are physically on campus.',
  },
  {
    id: 'planning',
    label: 'Weekly planning',
    pillar: 'career',
    category: 'career',
    defaultDays: [0],
    minutes: 25,
    priority: 'core',
    admin: true,
    rank: 6,
    prefer: 'morning',
    description: 'Clear the inbox, set next week’s milestone, one career action.',
  },
  {
    id: 'review',
    label: 'Weekly review',
    pillar: 'research',
    category: 'review',
    defaultDays: [0],
    minutes: 25,
    priority: 'core',
    admin: true,
    rank: 7,
    prefer: 'morning',
    description: 'Thirteen questions on the week that just happened.',
  },
];

export const TASK_KIND_BY_ID = new Map(TASK_KINDS.map((k) => [k.id, k]));

export function defaultCadences(): Record<string, number[]> {
  return Object.fromEntries(TASK_KINDS.map((k) => [k.id, [...k.defaultDays]]));
}

export function minutesFor(kind: TaskKind, dow: number): number {
  const weekend = dow === 0 || dow === 6;
  return weekend && kind.weekendMinutes !== undefined ? kind.weekendMinutes : kind.minutes;
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
