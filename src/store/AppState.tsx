import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  AppState, CardProgress, EnergyMode, FeedItem, FixedBlock, Insight,
  ScheduleSettings, Task, KnowledgeEntry, DayLog,
} from '../models';
import { DEFAULT_SCHEDULE } from '../models';
import { PILLARS } from '../data/pillars';
import { RESOURCES } from '../data/resources';
import { PROJECTS } from '../data/projects';
import { KNOWLEDGE } from '../data/knowledge';
import { today, mondayOf, addDays } from '../lib/date';
import { generateTasks, scheduleExisting } from '../engine/taskGenerator';
import { scheduleNextReview, initReview } from '../engine/spacedRepetition';
import { gradeCard } from '../data/flashcards';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthState';
// Type-only: erased at build time, so the server's fetch logic stays out of the
// browser bundle while the client still matches the API contract.
import type { MultiCalendarResponse } from '../../api/_lib/icsProxy';

const STORAGE_KEY = 'quant-os-state-v1';
const LAST_SYNC_KEY = 'quant-os-last-sync-v1';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

function buildInitialState(): AppState {
  return {
    profileName: 'Wen Yu',
    startDate: mondayOf(today()),
    pillars: PILLARS,
    tasks: [],
    dayLogs: [],
    resources: RESOURCES,
    projects: PROJECTS,
    knowledge: KNOWLEDGE.map(initReview),
    journal: [],
    weeklyReviews: [],
    monthlyReviews: [],
    applications: [],
    contacts: [],
    experiments: [
      { id: 'exp-1', title: 'Attend a quant workshop', status: 'planned', learned: '' },
      { id: 'exp-2', title: 'Talk to a quant researcher', status: 'planned', learned: '' },
      { id: 'exp-3', title: 'Replicate a paper', status: 'planned', learned: '' },
      { id: 'exp-4', title: 'Build an options project', status: 'planned', learned: '' },
    ],
    papers: [],
    deadlines: [],
    theme: 'dark',
    streak: 0,
    learnProgress: {},
    // --- v2 ---
    schedule: { ...DEFAULT_SCHEDULE },
    fixedBlocks: [],
    feed: [],
    cardProgress: {},
    deckSize: 0,
    drillLogs: [],
    insights: [],
    seedVersion: 2,
  };
}

// Merge a persisted/remote blob with fresh defaults so new fields/seed data
// appear after upgrades. Shared by localStorage load, Supabase pull, and
// manual JSON import.
function hydrate(parsed: Partial<AppState>): AppState {
  const base = buildInitialState();

  // Refresh resource definitions from source, but keep the user's per-resource
  // data (progress, their own PDF link, and any access override they set).
  const savedById = new Map((parsed.resources ?? []).map((r) => [r.id, r]));
  const mergedResources = base.resources.map((r) => {
    const saved = savedById.get(r.id);
    return saved
      ? { ...r, progress: saved.progress, pdfLink: saved.pdfLink, access: saved.access ?? r.access }
      : r;
  });
  const extraResources = (parsed.resources ?? []).filter((r) => !base.resources.some((b) => b.id === r.id));

  // Seed projects may gain new links/steps — refresh those, keep user progress.
  const savedProjects = new Map((parsed.projects ?? []).map((p) => [p.id, p]));
  const mergedProjects = base.projects.map((p) => {
    const saved = savedProjects.get(p.id);
    if (!saved) return p;
    return {
      ...p,
      ...saved,
      resources: p.resources ?? saved.resources,
      starter: p.starter ?? saved.starter,
      effort: p.effort ?? saved.effort,
    };
  });
  const extraProjects = (parsed.projects ?? []).filter((p) => !base.projects.some((b) => b.id === p.id));

  return {
    ...base,
    ...parsed,
    pillars: parsed.pillars?.length ? parsed.pillars : base.pillars,
    resources: [...mergedResources, ...extraResources],
    projects: [...mergedProjects, ...extraProjects],
    // v2 fields tolerate older payloads.
    schedule: migrateSchedule({ ...base.schedule, ...(parsed.schedule ?? {}) }),
    fixedBlocks: parsed.fixedBlocks ?? base.fixedBlocks,
    feed: parsed.feed ?? base.feed,
    cardProgress: parsed.cardProgress ?? base.cardProgress,
    deckSize: parsed.deckSize ?? base.deckSize,
    drillLogs: parsed.drillLogs ?? base.drillLogs,
    insights: parsed.insights ?? base.insights,
    seedVersion: base.seedVersion,
  } as AppState;
}

/**
 * Older builds stored a single `icsUrl`. Lift it into the feeds list so an
 * existing local/remote state keeps working after the upgrade.
 */
function migrateSchedule(schedule: ScheduleSettings): ScheduleSettings {
  if (schedule.icsFeeds?.length) return schedule;
  const legacy = (schedule as ScheduleSettings & { icsUrl?: string }).icsUrl?.trim();
  const { icsUrl: _dropped, ...rest } = schedule as ScheduleSettings & { icsUrl?: string };
  return {
    ...rest,
    icsFeeds: legacy ? [{ id: 'feed-legacy', label: 'Calendar', url: legacy }] : [],
  } as ScheduleSettings;
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildInitialState();
    return hydrate(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return buildInitialState();
  }
}

type Action =
  | { type: 'REPLACE'; state: AppState }
  | { type: 'PATCH'; patch: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'REPLACE':
      return action.state;
    case 'PATCH':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

export interface CalendarSyncResult {
  ok: boolean;
  error?: string;
  imported?: number;
  /** How many of the subscribed feeds failed (others still imported). */
  failed?: number;
  /** All-day events — shown to the user, never used to block time. */
  allDay?: { title: string; start: string; end: string }[];
  /** Google Tasks found in the feeds; reported, not imported. */
  tasks?: number;
  stats?: { recurring: number; oneOff: number; allDay: number };
}

interface Ctx {
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  reset: () => void;
  importState: (data: Partial<AppState>) => void;
  // cloud sync
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  // domain helpers
  energyFor: (date: string) => EnergyMode;
  setEnergy: (date: string, energy: EnergyMode) => { notes: string[] };
  ensureTasksForDate: (date: string) => { notes: string[] };
  regenerateTasks: (date: string) => { notes: string[] };
  rescheduleDay: (date: string) => void;
  toggleTask: (id: string) => void;
  addTask: (t: Task) => void;
  updateTask: (t: Task) => void;
  deleteTask: (id: string) => void;
  rescheduleMissed: (fromDate: string) => number;
  reviewKnowledge: (id: string, remembered: boolean) => void;
  // v2: rhythm
  updateSchedule: (p: Partial<ScheduleSettings>) => void;
  setCadence: (kindId: string, days: number[]) => void;
  syncCalendar: () => Promise<CalendarSyncResult>;
  addFixedBlock: (b: FixedBlock) => void;
  updateFixedBlock: (b: FixedBlock) => void;
  removeFixedBlock: (id: string) => void;
  // v2: inbox
  addFeedItem: (f: FeedItem) => void;
  setFeedStatus: (id: string, status: FeedItem['status']) => void;
  removeFeedItem: (id: string) => void;
  // v2: drill
  setDeckSize: (n: number) => void;
  reviewCard: (id: string, remembered: boolean) => void;
  logDrill: (correct: number, total: number) => void;
  // v2: insights
  addInsight: (i: Insight) => void;
  updateInsight: (i: Insight) => void;
  removeInsight: (id: string) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const { session } = useAuth();
  const userId = session?.user.id;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isSupabaseConfigured ? 'idle' : 'offline');
  const [hasPulled, setHasPulled] = useState(false);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [state.theme]);

  // Initial pull: on sign-in, compare the remote row's timestamp against the
  // last timestamp we've seen locally. Adopt remote if it's newer; otherwise
  // this device has unsynced local changes, so push handles seeding it up.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) return;
    let cancelled = false;
    setHasPulled(false);
    setSyncStatus('syncing');

    supabase
      .from('app_state')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setSyncStatus('error');
        } else if (data) {
          const localLastSync = localStorage.getItem(LAST_SYNC_KEY);
          const remoteIsNewer = !localLastSync || new Date(data.updated_at) > new Date(localLastSync);
          if (remoteIsNewer) {
            applyingRemoteRef.current = true;
            dispatch({ type: 'REPLACE', state: hydrate(data.data as Partial<AppState>) });
            localStorage.setItem(LAST_SYNC_KEY, data.updated_at);
          }
          setSyncStatus('synced');
        } else {
          setSyncStatus('synced');
        }
        setHasPulled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime: pick up edits made from another signed-in device immediately.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) return;
    const channel = supabase
      .channel(`app_state_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { data: AppState; updated_at: string } | undefined;
          if (!row) return;
          const localLastSync = localStorage.getItem(LAST_SYNC_KEY);
          const remoteIsNewer = !localLastSync || new Date(row.updated_at) > new Date(localLastSync);
          if (remoteIsNewer) {
            applyingRemoteRef.current = true;
            dispatch({ type: 'REPLACE', state: hydrate(row.data) });
            localStorage.setItem(LAST_SYNC_KEY, row.updated_at);
          }
        }
      )
      .subscribe();

    const client = supabase;
    return () => {
      client.removeChannel(channel);
    };
  }, [userId]);

  // Debounced push: any local change (that didn't just come from a remote
  // pull/realtime event) gets uploaded shortly after it happens.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId || !hasPulled) return;
    const client = supabase;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSyncStatus('syncing');
      const now = new Date().toISOString();
      client
        .from('app_state')
        .upsert({ user_id: userId, data: state, updated_at: now })
        .then(({ error }) => {
          if (error) setSyncStatus('error');
          else {
            localStorage.setItem(LAST_SYNC_KEY, now);
            setSyncStatus('synced');
          }
        });
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, hasPulled]);

  const patch = (p: Partial<AppState>) => dispatch({ type: 'PATCH', patch: p });

  // ------------------------------------------------------------------ tasks

  const energyFor = (date: string): EnergyMode => {
    const log = state.dayLogs.find((d) => d.date === date);
    return log?.energy ?? 'normal';
  };

  const setEnergy = (date: string, energy: EnergyMode) => {
    const logs = state.dayLogs.slice();
    const idx = logs.findIndex((d) => d.date === date);
    const budgetMap = { low: 45, min: 45, normal: 120, high: 180 } as const;
    const log: DayLog = idx >= 0
      ? { ...logs[idx], energy, availableMinutes: budgetMap[energy] }
      : { date, energy, availableMinutes: budgetMap[energy], completedTaskIds: [] };
    if (idx >= 0) logs[idx] = log; else logs.push(log);
    // Regenerate today's generated tasks for new energy (preserve user-added + done status).
    const nonGen = state.tasks.filter((t) => t.date !== date || !t.generated);
    const { tasks, notes } = generateTasks({ ...state, dayLogs: logs }, date, energy);
    const prevDone = new Set(state.tasks.filter((t) => t.date === date && t.status === 'done').map((t) => t.id));
    const merged = tasks.map((t) => (prevDone.has(t.id) ? { ...t, status: 'done' as const } : t));
    patch({ dayLogs: logs, tasks: [...nonGen, ...merged] });
    return { notes };
  };

  const ensureTasksForDate = (date: string) => {
    const existing = state.tasks.filter((t) => t.date === date && t.generated);
    if (existing.length > 0) return { notes: [] as string[] };
    const energy = energyFor(date);
    const { tasks, notes } = generateTasks(state, date, energy);
    patch({ tasks: [...state.tasks, ...tasks] });
    return { notes };
  };

  const regenerateTasks = (date: string) => {
    const energy = energyFor(date);
    const nonGen = state.tasks.filter((t) => t.date !== date || !t.generated);
    const { tasks, notes } = generateTasks({ ...state, tasks: nonGen }, date, energy);
    patch({ tasks: [...nonGen, ...tasks] });
    return { notes };
  };

  /** Re-place the day's tasks into free slots without changing what they are. */
  const rescheduleDay = (date: string) => {
    const days = state.tasks.filter((t) => t.date === date);
    const rest = state.tasks.filter((t) => t.date !== date);
    patch({ tasks: [...rest, ...scheduleExisting(state, date, days)] });
  };

  const toggleTask = (id: string) => {
    patch({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
      ),
    });
  };

  const addTask = (t: Task) => patch({ tasks: [...state.tasks, t] });
  const updateTask = (t: Task) => patch({ tasks: state.tasks.map((x) => (x.id === t.id ? t : x)) });
  const deleteTask = (id: string) => patch({ tasks: state.tasks.filter((t) => t.id !== id) });

  // Intelligently reschedule missed CORE tasks from a past date: spread onto the
  // next few days rather than dumping them all on tomorrow. Optional tasks are dropped.
  const rescheduleMissed = (fromDate: string): number => {
    const missed = state.tasks.filter(
      (t) => t.date === fromDate && t.status === 'pending' && t.priority === 'core'
    );
    if (missed.length === 0) return 0;
    const rest = state.tasks.filter((t) => !(t.date === fromDate && t.status === 'pending'));
    const moved = missed.map((t, i) => ({
      ...t,
      id: `resched-${t.id}-${i}`,
      date: addDays(fromDate, 1 + (i % 3)), // spread across next 3 days
      rescheduledFrom: fromDate,
      generated: false,
      startTime: undefined,
    }));
    patch({ tasks: [...rest, ...moved] });
    return moved.length;
  };

  const reviewKnowledge = (id: string, remembered: boolean) => {
    patch({
      knowledge: state.knowledge.map((e: KnowledgeEntry) =>
        e.id === id ? scheduleNextReview(e, remembered) : e
      ),
    });
  };

  // --------------------------------------------------------------- schedule

  const updateSchedule = (p: Partial<ScheduleSettings>) => {
    const schedule = { ...(state.schedule ?? DEFAULT_SCHEDULE), ...p };
    const next = { ...state, schedule };
    patch({ schedule, tasks: rescheduleAll(next) });
  };

  /** Re-place every upcoming task after the rhythm changes. */
  const rescheduleAll = (s: AppState): Task[] => {
    const byDate = new Map<string, Task[]>();
    for (const t of s.tasks) {
      const arr = byDate.get(t.date) ?? [];
      arr.push(t);
      byDate.set(t.date, arr);
    }
    return [...byDate.entries()].flatMap(([date, tasks]) => scheduleExisting(s, date, tasks));
  };

  /** Change which weekdays a task kind lands on, then re-place today's tasks. */
  const setCadence = (kindId: string, days: number[]) => {
    const cadences = { ...(state.schedule?.cadences ?? {}), [kindId]: [...days].sort() };
    const schedule = { ...(state.schedule ?? DEFAULT_SCHEDULE), cadences };
    patch({ schedule, tasks: rescheduleAll({ ...state, schedule }) });
  };

  const syncCalendar = async (): Promise<CalendarSyncResult> => {
    const feeds = (state.schedule?.icsFeeds ?? []).filter((f) => f.url.trim());
    if (feeds.length === 0) return { ok: false, error: 'Add at least one calendar link first.' };
    const from = today();
    const to = addDays(from, 42);
    const tz = state.schedule?.tzOffsetMinutes ?? 480;
    try {
      const qs = feeds.map((f) => `url=${encodeURIComponent(f.url.trim())}`).join('&');
      const res = await fetch(`/api/calendar?${qs}&from=${from}&to=${to}&tz=${tz}`);
      // Reuse the API's own response type so the client can't drift from it.
      const data = (await res.json()) as MultiCalendarResponse;
      if (!data.ok) return { ok: false, error: data.error ?? 'Calendar sync failed.' };

      // Map each event back to the calendar it came from, so three calendars
      // stay tellable apart in the UI instead of one merged wall of text.
      const labelFor = (url?: string) => {
        if (!url) return undefined;
        const feed = feeds.find((f) => f.url.trim() === url.trim());
        return feed?.label?.trim() || undefined;
      };

      const imported: FixedBlock[] = (data.events ?? []).map((e) => ({
        id: e.recurring ? `ics-${e.uid}-${e.start}` : `ics-${e.uid}-${e.start}-${e.date}`,
        title: e.title,
        start: e.start,
        end: e.end,
        // A one-off keeps its exact date and no weekdays; anything else would
        // turn a single appointment into a weekly recurring block.
        days: e.recurring ? e.days : [],
        date: e.recurring ? undefined : e.date,
        location: 'anywhere',
        source: 'ics',
        icsUid: e.uid,
        calendarLabel: labelFor(e.sourceUrl),
      }));
      const manual = (state.fixedBlocks ?? []).filter((b) => b.source !== 'ics');
      const next = { ...state, fixedBlocks: [...manual, ...imported] };
      patch({ fixedBlocks: next.fixedBlocks, tasks: rescheduleAll(next) });

      const failed = (data.feeds ?? []).filter((f) => !f.ok);
      return {
        ok: true,
        imported: imported.length,
        failed: failed.length,
        allDay: data.allDay ?? [],
        tasks: data.tasks ?? 0,
        stats: data.stats,
        error: failed.length
          ? `${failed.length} of ${feeds.length} calendars failed: ${failed[0].error ?? 'unknown error'}`
          : undefined,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Calendar sync failed.' };
    }
  };

  const addFixedBlock = (b: FixedBlock) => {
    const blocks = [...(state.fixedBlocks ?? []), b];
    patch({ fixedBlocks: blocks, tasks: rescheduleAll({ ...state, fixedBlocks: blocks }) });
  };
  const updateFixedBlock = (b: FixedBlock) => {
    const blocks = (state.fixedBlocks ?? []).map((x) => (x.id === b.id ? b : x));
    patch({ fixedBlocks: blocks, tasks: rescheduleAll({ ...state, fixedBlocks: blocks }) });
  };
  const removeFixedBlock = (id: string) => {
    const blocks = (state.fixedBlocks ?? []).filter((x) => x.id !== id);
    patch({ fixedBlocks: blocks, tasks: rescheduleAll({ ...state, fixedBlocks: blocks }) });
  };

  // ------------------------------------------------------------------ inbox

  const addFeedItem = (f: FeedItem) => patch({ feed: [f, ...(state.feed ?? [])] });
  const setFeedStatus = (id: string, status: FeedItem['status']) =>
    patch({ feed: (state.feed ?? []).map((f) => (f.id === id ? { ...f, status } : f)) });
  const removeFeedItem = (id: string) => patch({ feed: (state.feed ?? []).filter((f) => f.id !== id) });

  // ------------------------------------------------------------------ drill

  const setDeckSize = (n: number) => {
    if (state.deckSize !== n) patch({ deckSize: n });
  };
  const reviewCard = (id: string, remembered: boolean) => {
    const prev: CardProgress | undefined = state.cardProgress?.[id];
    patch({ cardProgress: { ...(state.cardProgress ?? {}), [id]: gradeCard(prev, remembered) } });
  };
  const logDrill = (correct: number, total: number) => {
    const d = today();
    const logs = (state.drillLogs ?? []).filter((l) => l.date !== d);
    patch({ drillLogs: [...logs, { date: d, correct, total }].slice(-120) });
  };

  // --------------------------------------------------------------- insights

  const addInsight = (i: Insight) => patch({ insights: [i, ...(state.insights ?? [])] });
  const updateInsight = (i: Insight) =>
    patch({ insights: (state.insights ?? []).map((x) => (x.id === i.id ? i : x)) });
  const removeInsight = (id: string) =>
    patch({ insights: (state.insights ?? []).filter((x) => x.id !== id) });

  // ------------------------------------------------------------------ reset

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    dispatch({ type: 'REPLACE', state: buildInitialState() });
  };

  const importState = (data: Partial<AppState>) => {
    dispatch({ type: 'REPLACE', state: hydrate(data) });
  };

  const value = useMemo<Ctx>(
    () => ({
      state, patch, reset, importState, syncEnabled: isSupabaseConfigured, syncStatus,
      energyFor, setEnergy, ensureTasksForDate, regenerateTasks, rescheduleDay,
      toggleTask, addTask, updateTask, deleteTask, rescheduleMissed, reviewKnowledge,
      updateSchedule, setCadence, syncCalendar, addFixedBlock, updateFixedBlock, removeFixedBlock,
      addFeedItem, setFeedStatus, removeFeedItem,
      setDeckSize, reviewCard, logDrill,
      addInsight, updateInsight, removeInsight,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, syncStatus]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
