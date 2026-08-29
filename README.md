# Quant-OS

A personal development dashboard (tasks, markets journal, projects, career tracking, reviews) built with React + TypeScript + Vite.

The core idea: **two core tasks a day beats six you never finish.** The planner knows your working hours, your calendar and your energy level, and hands you a short list with concrete start times.

## Features

| Area | What it does |
|---|---|
| **Today** | Timeline of your day — fixed commitments interleaved with tasks at concrete times. Energy modes: Min (1 core), Normal (2 core + 1 optional), Big (3 core + 1 optional). |
| **Settings** | Working hours, per-day task caps, buffer between blocks, campus days, and the calendar integration. |
| **Google Calendar** | Paste your calendar's *secret iCal address*; lectures and shifts become fixed blocks and tasks are fitted into the gaps. Read-only, fetched server-side by `api/calendar.ts`. |
| **Inbox** | One queue for Substacks, podcasts, earnings calls, papers and news. The daily plan pulls one item from it so the pile never grows. |
| **Knowledge → Drill** | Spaced-repetition flashcards generated from your interview books (`scripts/extract_flashcards.py`). |
| **Insights** | Three-line capture for anything worth keeping. The full 10-point paper template lives on under *Deep dives*. |
| **Projects** | Each project ships with curated links (docs, repos, datasets, readings) and a "first 30 minutes" checklist. |

## Getting started

```bash
npm install
npm run dev
```

By default the app runs in **local-only mode**: all data lives in this browser's `localStorage`. Nothing leaves your machine, and it works with zero setup.

## Optional: cross-device cloud sync (Supabase)

To access your dashboard from multiple devices with data kept in sync, wire it up to a free Supabase project.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier).
2. **Run the schema**: open the SQL Editor in your Supabase project and run the contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `app_state` table with row-level security (each user can only read/write their own row) and enables Realtime on it.
3. **Get your credentials**: Project Settings → API → copy the **Project URL** and the **anon/public key**.
4. **Configure the app**: copy `.env.example` to `.env.local` and paste in those two values:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
5. **Restart** `npm run dev` (or rebuild/redeploy). The app now shows a sign-in screen — enter your email, get a 6-digit code, enter it, and you're in. Sign in with the same email on every device you use.

Once signed in on 2+ devices, edits made on one device sync to the others automatically (live, via Supabase Realtime, plus a debounced push on every change). `localStorage` is still kept as an offline cache, so the app keeps working if you lose connectivity.

`.env.local` is git-ignored — don't commit real credentials. Leaving the env vars unset keeps the app in local-only mode.

### Making the dashboard reachable on other devices

Cloud sync solves *data*, but you still need the app itself to be reachable from other devices — e.g. deploy the built site (`npm run build` → `dist/`) to Vercel/Netlify/GitHub Pages for a permanent URL you can open from your phone, laptop, etc.

## Data export / import

Settings → Reviews page has manual **Export data (JSON)** and **Import data (JSON)** buttons for one-off backups or moving data between devices without cloud sync.

## Regenerating the flashcard deck

The interview deck is extracted from local PDFs that are **git-ignored** (they're copyrighted books). Drop the books in the project root, update `SOURCES` in [`scripts/extract_flashcards.py`](./scripts/extract_flashcards.py), then:

```bash
pip install pdfplumber
python3 scripts/extract_flashcards.py            # writes src/data/flashcards.generated.ts
python3 scripts/extract_flashcards.py --inspect  # preview quality without writing
```

Only short question/answer excerpts are emitted — the books themselves never enter the repo.
