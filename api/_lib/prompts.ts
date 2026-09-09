/**
 * Server-side prompt templates, one per allowed task.
 *
 * The client sends a task name plus structured payload — never a prompt. That
 * keeps /api/ai from becoming an open LLM proxy on a public Vercel URL, and
 * keeps prompt wording in one reviewable place.
 */

export const AI_TASKS = [
  'gradeAnswer',
  'followUp',
  'generateQuestions',
  'explainMove',
  'explainConcept',
  'gradeEstimate',
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export function isAiTask(value: unknown): value is AiTask {
  return typeof value === 'string' && (AI_TASKS as readonly string[]).includes(value);
}

export interface PromptSpec {
  system: string;
  user: string;
  tier: 'fast' | 'smart';
  maxTokens: number;
  json: boolean;
}

// --------------------------------------------------------------- payloads

export interface GradeAnswerPayload {
  question: string;
  modelAnswer: string;
  userAnswer: string;
  topic?: string;
}

export interface FollowUpPayload {
  question: string;
  modelAnswer: string;
  userAnswer?: string;
  topic?: string;
}

export interface GenerateQuestionsPayload {
  topic: string;
  syllabus?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  count?: number;
  exclude?: string[];
}

export interface ExplainMovePayload {
  date: string;
  moves: { symbol: string; changePct: number }[];
  headlines: string[];
  userDraft?: string;
}

export interface ExplainConceptPayload {
  concept: string;
  context?: string;
  level: 'nudge' | 'approach' | 'full';
}

export interface GradeEstimatePayload {
  prompt: string;
  userAnswer: string;
  userWorking?: string;
}

// ----------------------------------------------------------------- limits

/** Truncation caps, so a pasted essay cannot inflate a request. */
const CAP = { short: 600, medium: 2_000, long: 4_000 };

function clip(text: unknown, max: number): string {
  const s = typeof text === 'string' ? text.trim() : '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function list(items: unknown, max: number, cap = CAP.short): string {
  if (!Array.isArray(items)) return '';
  return items.slice(0, max).map((i) => `- ${clip(i, cap)}`).join('\n');
}

// ----------------------------------------------------------------- shared

const INTERVIEWER = `You are a senior quantitative trader who runs technical interviews for a proprietary trading firm and a systematic hedge fund. You are precise, terse and hold a high bar. You never flatter. When something is wrong you say exactly what is wrong.`;

const JSON_RULE = `Respond with a single JSON object and nothing else. No prose, no markdown fences.`;

// ---------------------------------------------------------------- builder

/**
 * Returns undefined when the payload is unusable, so the route can answer 400
 * rather than spend a model call on nonsense.
 */
export function buildPrompt(task: AiTask, raw: unknown): PromptSpec | undefined {
  const p = (raw ?? {}) as Record<string, unknown>;

  switch (task) {
    case 'gradeAnswer': {
      const question = clip(p.question, CAP.medium);
      const modelAnswer = clip(p.modelAnswer, CAP.long);
      const userAnswer = clip(p.userAnswer, CAP.long);
      if (!question || !userAnswer) return undefined;
      return {
        tier: 'fast',
        maxTokens: 700,
        json: true,
        system: `${INTERVIEWER}

Grade the candidate's spoken-style answer against the reference answer. Grade the substance, not the wording: an answer that reaches the right conclusion by a different valid route scores full marks, and a fluent answer that misses the core mechanism does not.

Scoring:
3 = correct and complete; would satisfy an interviewer with no follow-up needed.
2 = core idea right, one meaningful omission or imprecision.
1 = partially right; a real gap or a confused mechanism.
0 = wrong, or a non-answer.

${JSON_RULE} Schema:
{"score":0|1|2|3,"verdict":"one sentence","missed":["specific point omitted", "..."],"wrong":["specific claim that is incorrect", "..."],"nitpick":"optional one-line precision note or null"}
Keep "missed" and "wrong" concrete and short. Empty arrays are fine.`,
        user: `${p.topic ? `Topic: ${clip(p.topic, 120)}\n\n` : ''}Question:\n${question}\n\nReference answer:\n${modelAnswer || '(none supplied — judge on your own knowledge)'}\n\nCandidate's answer:\n${userAnswer}`,
      };
    }

    case 'followUp': {
      const question = clip(p.question, CAP.medium);
      if (!question) return undefined;
      return {
        tier: 'fast',
        maxTokens: 400,
        json: true,
        system: `${INTERVIEWER}

The candidate has just answered. Ask exactly ONE follow-up that probes whether they actually understand the mechanism rather than having memorised the answer — the way a real interviewer pushes: change an assumption, take a limit, ask for the intuition behind a formula, or ask what breaks in practice.

The follow-up must be answerable in under two minutes and must not simply restate the original question.

${JSON_RULE} Schema:
{"question":"the follow-up","why":"one line on what it tests","answer":"the answer you are looking for, 1-3 sentences"}`,
        user: `Original question:\n${question}\n\nReference answer:\n${clip(p.modelAnswer, CAP.long) || '(none)'}\n\n${p.userAnswer ? `The candidate said:\n${clip(p.userAnswer, CAP.long)}` : 'The candidate answered acceptably.'}`,
      };
    }

    case 'generateQuestions': {
      const topic = clip(p.topic, 200);
      if (!topic) return undefined;
      const count = Math.min(Math.max(Number(p.count) || 5, 1), 10);
      const syllabus = list(p.syllabus, 20);
      const exclude = list(p.exclude, 40, 200);
      return {
        tier: 'smart',
        maxTokens: 2_000,
        json: true,
        system: `${INTERVIEWER}

Write ${count} interview questions on the given topic, at the level a quant trading or quant research internship actually asks. Prefer questions that require reasoning over recall. Include the working in the answer, not just the result — a number with no derivation is useless for study.

Rules:
- Every question must be self-contained and unambiguous.
- Every answer must be correct. If you are not certain of a numeric result, choose a different question.
- Vary the difficulty across the set.
- Do not repeat any question in the exclusion list, including reworded versions.

${JSON_RULE} Schema:
{"questions":[{"q":"...","a":"...","difficulty":"beginner|intermediate|advanced","tags":["..."]}]}`,
        user: `Topic: ${topic}
${p.difficulty ? `Target difficulty: ${clip(p.difficulty, 40)}\n` : ''}${syllabus ? `\nSub-topics to draw from:\n${syllabus}\n` : ''}${exclude ? `\nAlready asked — do not repeat:\n${exclude}\n` : ''}`,
      };
    }

    case 'explainMove': {
      const moves = Array.isArray(p.moves) ? p.moves.slice(0, 30) : [];
      if (moves.length === 0) return undefined;
      const table = moves
        .map((m) => {
          const { symbol, changePct } = (m ?? {}) as { symbol?: unknown; changePct?: unknown };
          const pct = Number(changePct);
          return `${clip(symbol, 20)}: ${Number.isFinite(pct) ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : 'n/a'}`;
        })
        .join('\n');
      const draft = clip(p.userDraft, CAP.long);
      return {
        tier: 'smart',
        maxTokens: 1_200,
        json: true,
        system: `You are a macro strategist writing the morning note for a trading desk.

Given the day's cross-asset moves and headlines, lay out the causal chain: what happened, the mechanism by which it transmitted to each asset, and what would confirm or falsify the story tomorrow.

Be honest about uncertainty. If the moves do not have an obvious common driver, say so — "positioning and month-end flows" is a legitimate answer and a fabricated narrative is worse than none. Never invent a headline or a data release that was not supplied.

${JSON_RULE} Schema:
{"chain":["step 1","step 2","..."],"perAsset":[{"symbol":"...","why":"one line"}],"watchNext":["what would confirm or falsify this"],"confidence":"high|medium|low","critique":"if a draft was supplied: what it got right, what it missed. Otherwise null"}`,
        user: `Date: ${clip(p.date, 20) || 'today'}

Moves:
${table}

Headlines:
${list(p.headlines, 15, 300) || '(none supplied)'}

${draft ? `The user's own explanation, for critique:\n${draft}` : 'No user draft — do not critique.'}`,
      };
    }

    case 'explainConcept': {
      const concept = clip(p.concept, CAP.medium);
      if (!concept) return undefined;
      const level = p.level === 'full' ? 'full' : p.level === 'approach' ? 'approach' : 'nudge';
      const instruction = {
        nudge: 'Give ONE sentence that points at the idea they are missing. Do not reveal the method or the answer.',
        approach: 'Name the approach and the first concrete step, in 2-4 sentences. Stop before the result.',
        full: 'Give the full explanation with the reasoning, in under 250 words. Show the working.',
      }[level];
      return {
        tier: 'fast',
        maxTokens: level === 'full' ? 800 : 300,
        json: false,
        system: `You are a patient quant tutor. The student is working on a problem and is stuck. ${instruction}

Plain prose. No preamble, no "great question", no restating the problem back at them.`,
        user: `${concept}${p.context ? `\n\nContext:\n${clip(p.context, CAP.long)}` : ''}`,
      };
    }

    case 'gradeEstimate': {
      const prompt = clip(p.prompt, CAP.medium);
      const userAnswer = clip(p.userAnswer, 200);
      if (!prompt || !userAnswer) return undefined;
      return {
        tier: 'smart',
        maxTokens: 900,
        json: true,
        system: `${INTERVIEWER}

This is a Fermi estimation question — the kind Jane Street and Optiver use. Judge two things separately:
1. Whether the final number is within an order of magnitude of a defensible estimate.
2. The quality of the decomposition — did they break the problem into quantities a person can actually anchor, and did they state their assumptions?

The decomposition matters more than the number. A well-reasoned answer that lands 3x off beats a lucky guess with no working.

${JSON_RULE} Schema:
{"referenceEstimate":"your own estimate with the chain of assumptions","withinOrderOfMagnitude":true|false,"decompositionScore":0|1|2|3,"goodMoves":["..."],"feedback":"what to do differently, 1-3 sentences"}`,
        user: `Question:\n${prompt}\n\nTheir answer: ${userAnswer}\n\nTheir working:\n${clip(p.userWorking, CAP.long) || '(none shown)'}`,
      };
    }
  }
}
