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
  output: string; // what I should produce
  priority: TaskPriority;
  status: TaskStatus;
  generated: boolean; // auto-generated vs user-added
  rescheduledFrom?: string; // original date if rescheduled
}

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
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'assignment' | 'application' | 'other';
  pillar?: PillarId;
}
