// Core domain models for the Quant-OS personal development operating system.

export type PillarId =
  | 'academics'
  | 'programming'
  | 'ai'
  | 'finance'
  | 'research'
  | 'career';

export type TaskCategory =
  | 'markets'
  | 'technical'
  | 'finance'
  | 'ai'
  | 'research'
  | 'career'
  | 'output'
  | 'review';

export type EnergyMode = 'low' | 'min' | 'normal' | 'high';

export type TaskPriority = 'core' | 'optional';

export type TaskStatus = 'pending' | 'done' | 'skipped';

export interface Task {
  id: string;
  date: string; // ISO yyyy-mm-dd this task is scheduled for
  pillar: PillarId;
  category: TaskCategory;
  title: string;
  why: string; // why am I doing this
  minutes: number; // how long
  resourceId?: string; // link to resource library
  resourceHint?: string; // e.g. "Hull Ch.13"
  url?: string; // direct link (e.g. the specific Substack post or Quartr call)
  output: string; // what I should produce
  priority: TaskPriority;
  status: TaskStatus;
  generated: boolean; // auto-generated vs user-added
  rescheduledFrom?: string; // original date if rescheduled
  startTime?: string; // "HH:MM" — assigned by the scheduler from your free slots
  location?: TaskLocation; // campus-only tasks only land on days you're on campus
  /** Part of day this task suits best (markets read = morning, deep work = evening…). */
  prefer?: 'morning' | 'midday' | 'evening';
}

/** Where the task can physically be done. */
export type TaskLocation = 'anywhere' | 'campus';

export interface DayLog {
  date: string;
  energy: EnergyMode;
  availableMinutes: number;
  completedTaskIds: string[];
}

export interface Pillar {
  id: PillarId;
  name: string;
  score: number; // 0-100 current capability
  targetHoursPerWeek: number;
  color: string;
  description: string;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Resource {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  url: string;
  usefulFor: string;
  whenToUse: string;
  related: string[];
  access: 'free' | 'paywalled' | 'ntu' | 'owned';
  progress?: number; // 0-100
  pdfLink?: string; // user's own copy (Drive/OneDrive/library link)
}

export type ProjectResourceType = 'repo' | 'reading' | 'guide' | 'dataset' | 'video' | 'tool' | 'docs';

export interface ProjectResource {
  id: string;
  label: string;
  url: string;
  type: ProjectResourceType;
  note?: string;
  needsCampus?: boolean; // e.g. requires the Bloomberg terminal
}

export type ProjectStatus = 'backlog' | 'active' | 'paused' | 'done';

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  week?: number;
}

export interface Project {
  id: string;
  name: string;
  objective: string;
  whyItMatters: string;
  skills: string[];
  startDate?: string;
  targetDate?: string;
  status: ProjectStatus;
  nextAction: string;
  repoLink?: string;
  output?: string;
  lessons?: string;
  milestones: Milestone[];
  pillars: PillarId[];
  /** Curated links so you never start from a blank page. */
  resources?: ProjectResource[];
  /** Concrete "first 30 minutes" steps to beat the blank-page problem. */
  starter?: string[];
  /** Rough effort estimate so you know what you're signing up for. */
  effort?: '1 weekend' | '1 week' | '2-3 weeks' | '1 month+';
}

export interface KnowledgeEntry {
  id: string;
  concept: string;
  category: string;
  definition: string;
  intuition: string;
  formula?: string;
  example: string;
  commonMistake: string;
  related: string[];
  lastReviewed?: string;
  nextReview?: string;
  srsStage: number; // spaced-repetition stage index
}

export interface MarketJournalEntry {
  id: string;
  date: string;
  assetClasses: AssetClass[]; // one event can affect several asset classes
  ticker: string;
  event: string;
  whatHappened: string;
  whyItHappened: string;
  myPrediction: string;
  actualOutcome: string;
  confidence: number; // 1-5
  lesson: string;
}

export type AssetClass = 'equities' | 'rates' | 'fx' | 'commodities' | 'options' | 'crypto';

export interface WeeklyReview {
  id: string;
  weekOf: string; // Monday ISO date
  learned: string;
  built: string;
  read: string;
  biggestImprovement: string;
  biggestWeakness: string;
  enjoyed: string;
  disliked: string;
  surprised: string;
  opportunity: string;
  stopDoing: string;
  startDoing: string;
  continueDoing: string;
  nextMostImportantOutput: string;
}

export interface MonthlyReview {
  id: string;
  month: string; // yyyy-mm
  startingCapability: string;
  currentCapability: string;
  biggestGains: string;
  biggestWeaknesses: string;
  highestRoi: string;
  lowestRoi: string;
  newCareerDirection: string;
  nextMonthPriorities: string;
}

export type ApplicationStatus =
  | 'researching'
  | 'applied'
  | 'oa'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface CareerApplication {
  id: string;
  company: string;
  role: string;
  deadline?: string;
  status: ApplicationStatus;
  cvVersion?: string;
  interviewStage?: string;
  nextAction?: string;
  result?: string;
  lessons?: string;
}

export interface Contact {
  id: string;
  name: string;
  type: 'professor' | 'alumni' | 'industry' | 'peer';
  dateContacted?: string;
  topic?: string;
  advice?: string;
  followUpDate?: string;
}

export interface CareerExperiment {
  id: string;
  title: string;
  status: 'planned' | 'in-progress' | 'done';
  learned: string; // what did I learn about whether I like this career
}

// 10-point paper critique template.
export interface PaperNote {
  id: string;
  title: string;
  link?: string;
  date: string;
  researchQuestion: string;
  whyMatters: string;
  dataset: string;
  method: string;
  baseline: string;
  mainResult: string;
  evaluation: string;
  weaknesses: string;
  whatIWouldChange: string;
  followUp: string;
}

export interface CurriculumMonth {
  month: number; // 1-12
  theme: string;
  focus: string[];
  weeks: CurriculumWeek[];
}

export interface CurriculumWeek {
  week: number; // global week number 1-48
  learningGoal: string;
  outputGoal: string;
  careerGoal: string;
  reviewGoal: string;
  topics: string[];
  primaryPillar: PillarId;
}

export interface AppState {
  profileName: string;
  startDate: string; // when the program started (drives week/month position)
  pillars: Pillar[];
  tasks: Task[];
  dayLogs: DayLog[];
  resources: Resource[];
  projects: Project[];
  knowledge: KnowledgeEntry[];
  journal: MarketJournalEntry[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  applications: CareerApplication[];
  contacts: Contact[];
  experiments: CareerExperiment[];
  papers: PaperNote[];
  deadlines: Deadline[];
  theme: 'dark' | 'light';
  streak: number;
  learnProgress: Record<string, boolean>; // learning-track topic completion
  // --- v2: rhythm, inputs, drill, insights ---
  schedule: ScheduleSettings;
  fixedBlocks: FixedBlock[];
  feed: FeedItem[];
  /** cardId -> progress. Card text comes from the bundled deck. */
  cardProgress: Record<string, CardProgress>;
  /** Cards loaded from the bundled deck (0 until the deck is opened once). */
  deckSize: number;
  drillLogs: DrillLog[];
  insights: Insight[];
  /** Bumped when seed data changes so new decks/links appear on upgrade. */
  seedVersion?: number;
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'assignment' | 'application' | 'other';
  pillar?: PillarId;
}

// ---------------------------------------------------------------------------
// Daily rhythm: sleep window, fixed commitments, task budget
// ---------------------------------------------------------------------------

// Imported late to avoid a cycle: cadences.ts imports types from this file,
// and it is the single source of truth for which weekdays each task lands on.
import { defaultCadences } from '../data/cadence.js';

export interface ScheduleSettings {
  /** Earliest you're willing to be up — "HH:MM". */
  wakeTime: string;
  /** Latest you're willing to be working — "HH:MM" (past midnight allowed). */
  sleepTime: string;
  /** Breathing room enforced around every block, in minutes. */
  bufferMinutes: number;
  /** Hard caps on how much the day asks of you. */
  maxCoreTasks: number;
  maxOptionalTasks: number;
  /** Days you're physically on campus (0=Sun … 6=Sat) — gates terminal tasks. */
  campusDays: number[];
  /** Google Calendar iCal feeds (secret or public address). */
  icsFeeds: CalendarFeed[];
  /**
   * Weekday list per task kind (0=Sun … 6=Sat). Tasks land on these days
   * deterministically instead of being drawn at random each morning.
   */
  cadences: Record<string, number[]>;
  /** Assign concrete start times from your free slots. */
  autoSchedule: boolean;
  /** Minutes offset from UTC for your calendar (Singapore = 480). */
  tzOffsetMinutes: number;
}

/** One subscribed calendar — you can have personal, school and work feeds. */
export interface CalendarFeed {
  id: string;
  label: string;
  url: string;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  wakeTime: '06:00',
  sleepTime: '01:00',
  bufferMinutes: 15,
  maxCoreTasks: 2,
  maxOptionalTasks: 1,
  campusDays: [1, 2, 3, 4, 5],
  icsFeeds: [],
  cadences: defaultCadences(),
  autoSchedule: true,
  tzOffsetMinutes: 480,
};

/** A recurring or one-off commitment imported from a calendar or entered by hand. */
export interface FixedBlock {
  id: string;
  title: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  /** Weekdays this repeats on (0=Sun … 6=Sat). Empty means one-off. */
  days: number[];
  /** Set only for one-off blocks. */
  date?: string;
  location: TaskLocation;
  source: 'manual' | 'ics';
  /** Kept so a re-import updates rather than duplicates. */
  icsUid?: string;
  /** Which subscribed calendar this came from (for display only). */
  calendarLabel?: string;
}

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  minutes: number;
  /** Start in absolute minutes, so slots past midnight stay comparable. */
  startAbs: number;
}

// ---------------------------------------------------------------------------
// Inbox: the daily input menu (Substacks, podcasts, earnings calls, papers…)
// ---------------------------------------------------------------------------

export type FeedType = 'substack' | 'podcast' | 'earnings' | 'news' | 'paper' | 'video' | 'terminal';

export interface FeedSource {
  id: string;
  name: string;
  type: FeedType;
  url: string;
  cadence: string;
  defaultMinutes: number;
  pillar: PillarId;
  needsCampus?: boolean;
  note?: string;
}

export interface FeedItem {
  id: string;
  title: string;
  type: FeedType;
  url?: string;
  source: string; // "Thoughts on the Market", "Quartr", "Doomberg"…
  estMinutes: number;
  pillar: PillarId;
  status: 'inbox' | 'done' | 'archived';
  addedAt: string;
  notes?: string;
  needsCampus?: boolean;
}

// ---------------------------------------------------------------------------
// Flashcards (interview drill) & Insights (lightweight research capture)
// ---------------------------------------------------------------------------

export interface FlashcardSeed {
  deck: string;
  section: string;
  question: string;
  answer: string;
  quality?: 'high' | 'fair';
}

export interface Flashcard {
  id: string;
  deck: string;
  section: string;
  question: string;
  answer: string;
  quality: 'high' | 'fair';
  srsStage: number;
  nextReview: string;
  lastReviewed?: string;
  timesSeen: number;
  timesCorrect: number;
}

/**
 * Only progress is persisted. Card text lives in the bundled seed module, so the
 * synced state stays small even with a few hundred cards.
 */
export interface CardProgress {
  srsStage: number;
  nextReview: string;
  lastReviewed?: string;
  timesSeen: number;
  timesCorrect: number;
}

export interface DrillLog {
  date: string;
  correct: number;
  total: number;
}

export type InsightCategory = 'market' | 'company' | 'macro' | 'strategy' | 'technical' | 'career';

/** A lightweight capture — replaces the habit of "reading a paper and forgetting it". */
export interface Insight {
  id: string;
  date: string;
  title: string;
  source: string;
  sourceUrl?: string;
  takeaway: string;
  tags: string[];
  pillar: PillarId;
  category: InsightCategory;
  rating?: number; // 1-5 — was it worth the time?
  linkedProjectId?: string;
}
