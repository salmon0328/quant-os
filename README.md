# Quant-OS

A personal development dashboard for getting ready for quant and markets roles: a planner that
names the next concrete thing to do, an interview drill built from real books, a technical
syllabus with runnable exercises, live market data with scored predictions, and the online
assessments prop firms actually use.

React + TypeScript + Vite, with a handful of serverless functions.

## The idea

**Two core tasks a day beats six you never finish** — and a task is only useful if it names
something specific. The planner knows your working hours, your calendar and your energy level, and
hands you a short list with concrete start times, where each item is the *next* problem, terminal
function or book chapter rather than a generic prompt.

## Features

| Area | What it does |
|---|---|
| **Today** | Your day as a timeline: fixed commitments from your calendar interleaved with tasks at real start times. Energy modes cap the load (Min 1 core, Normal 2 + 1 optional, Big 3 + 1). |
| **Tracks** | Tasks come from ordered catalogues — the NeetCode 150, a 24-function Bloomberg terminal curriculum, and 74 book chapters. Completing one advances that track, so tomorrow asks for the next item, not the same one. |
| **Learn** | 10 subjects, 56 modules: probability through microstructure. Each has a lesson, glossary, quiz, and Python exercises that run in the browser. Algorithms modules link to the exact LeetCode problems. Failing a quiz question re-queues that concept in the drill. |
| **Interview Drill** | ~860 cards from your interview books plus a generated quant bank, on SM-2 spaced repetition. Filter by target role. Type an answer and have it marked against the model answer, then get pushed with a follow-up. Mock mode runs a timed round with a scorecard. |
| **OA Lab** | The screens firms actually use: 80-in-8 arithmetic, expected value under a clock, market making against a counterparty that only trades when you are wrong, timed grids, number series. Firm presets chain the batteries a given firm leans on. |
| **Markets** | Live tape, Treasury curve, and headlines you can turn into a journal entry in one click. Predictions carry a direction, horizon and confidence, resolve themselves, and are scored for calibration with a Brier score. |
| **Books** | 19 books with per-chapter tracking, wired to the planner's reading rotation. Link your own copy or a Google Play Books upload. |
| **Projects / Career / Reviews** | Milestone tracking, an application pipeline, and weekly/monthly review templates. |
| **Google Calendar** | Paste your calendar's *secret iCal address*; lectures and shifts become fixed blocks and tasks are fitted into the gaps. Read-only, fetched server-side. |

## Getting started

```bash
npm install
npm run dev
```

By default everything lives in this browser's `localStorage`. Nothing leaves your machine and it
works with zero setup — every integration below is optional and independent.

## Optional integrations

Copy `.env.example` to `.env.local` and fill in only what you want.

### Cross-device sync (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor. It creates `app_state`
   with row-level security and enables Realtime.
3. Put the project URL and anon key in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

Sign in with the same email on each device and edits sync live. `localStorage` stays as an offline
cache.

### AI features

Set `LLM_API_KEY` and `LLM_BASE_URL` for any OpenAI-compatible gateway. Defaults target
[9Router](https://9router.com/) on `http://localhost:20128/v1`.

This powers answer marking in the drill, interviewer follow-ups, free-text quiz grading, and the
market commentary — and it drives the content scripts below. Leave the key unset and every one of
those affordances is simply hidden; nothing breaks.

**A gateway on localhost is not reachable from a deployed build.** With the default base URL, AI
works in `npm run dev` and in the scripts but not on Vercel, where the app hides those buttons.
That costs little: the expensive work is offline, and its output is committed.

### Live market data

`FINNHUB_API_KEY` (free tier) for quotes and news, `FRED_API_KEY` (free) for rates, curves,
indices and macro history. Finnhub's candle and economic-calendar endpoints are paid-only, so
nothing here uses them — FRED draws the charts instead.

## Content scripts

The decks and lessons are generated offline and committed, so the deployed app carries them at no
runtime cost. All of them are resumable and cost nothing to re-run over already-finished work.

```bash
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)

# Extract Q/A pairs from interview PDFs dropped in the project root (git-ignored).
pip install pdfplumber
python3 scripts/extract_flashcards.py

# Repair the extracted answers and tag them by role/difficulty.
python3 scripts/clean_flashcards.py --inspect --sample 20   # read before writing
python3 scripts/clean_flashcards.py

# A purpose-built quant bank, since the source books are banking books.
python3 scripts/generate_quant_bank.py

# Lessons, quizzes and exercises for the Learn syllabus.
python3 scripts/generate_modules.py

# Re-solve every numeric quiz answer independently and drop the ones that fail.
python3 scripts/verify_quiz.py
```

**Treat generated content as a draft.** Two automated gates exist because spot-checking found real
problems: every code exercise is executed before being kept (the solution must pass its tests *and*
the starter code must fail them), and every numeric quiz answer is independently re-derived — that
pass corrected 18 of 76 wrong answer keys. Prose still wants your eye.

Only short excerpts are emitted from the source books; the PDFs never enter the repo.

## Data export / import

Reviews → Settings has manual **Export data (JSON)** and **Import data (JSON)** for backups or
moving between devices without cloud sync.

## Deploying

`npm run build` produces `dist/`. The repo is set up for Vercel zero-config: the Vite preset plus
the `/api` directory. `vite.config.ts` mirrors those functions in dev, so both environments run the
same handlers.
