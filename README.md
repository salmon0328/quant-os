# Quant-OS

A personal development dashboard (tasks, markets journal, projects, career tracking, reviews) built with React + TypeScript + Vite.

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
