import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchCalendar, requestFromQuery } from './src/lib/icsProxy.ts';

/**
 * Mirrors the Vercel /api/calendar function during `npm run dev` so the
 * calendar integration behaves identically locally and in production.
 */
function calendarApi(): Plugin {
  const handler = async (reqUrl: string, res: { statusCode: number; setHeader(k: string, v: string): void; end(b: string): void }) => {
    const parsed = new URL(reqUrl, 'http://localhost');
    const query = Object.fromEntries(parsed.searchParams.entries());
    const result = await fetchCalendar(requestFromQuery(query));
    res.statusCode = result.ok ? 200 : 400;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(result));
  };

  return {
    name: 'quant-os-calendar-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/calendar')) return next();
        void handler(req.url, res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), calendarApi()],
});
