import { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../store/AppState';
import { NEWS_ANALYSIS_FRAMEWORK, NEWS_BUTTONS } from '../data/newsFramework';
import { Card, SectionTitle, Chip, Modal, Field, EmptyState } from '../components/ui';
import type { MarketJournalEntry, AssetClass } from '../models';
import { today, addDays } from '../lib/date';
import { uid } from '../lib/id';
import {
  fetchDashboard, fetchCurve, CURVE_ORDER, CURVE_LABEL, TAPE_SERIES,
  formatSeriesValue, isPercentSeries,
  type Quote, type Series, type NewsItem,
} from '../lib/market';
import { aiAvailable, explainMove, AiError, type MoveExplanation } from '../lib/ai';
import { calibration, calibrationNote, isDue, resolve } from '../engine/predictions';
import type { Prediction } from '../models';
import { DEFAULT_WATCHLIST, WATCHLIST_HINT } from '../data/watchlist';

const ASSET_CLASSES: AssetClass[] = ['equities', 'rates', 'fx', 'commodities', 'options', 'crypto'];

const emptyEntry: MarketJournalEntry = {
  id: '', date: today(), assetClasses: ['equities'], ticker: '', event: '', whatHappened: '', whyItHappened: '', myPrediction: '', actualOutcome: '', confidence: 3, lesson: '',
};

// Older entries may have a single `assetClass`; normalise to an array.
function classesOf(e: MarketJournalEntry): AssetClass[] {
  if (Array.isArray(e.assetClasses)) return e.assetClasses;
  const legacy = (e as unknown as { assetClass?: AssetClass }).assetClass;
  return legacy ? [legacy] : [];
}

export default function Markets() {
  const { state, patch, addPrediction, resolvePredictions } = useApp();
  const [editing, setEditing] = useState<MarketJournalEntry | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // --- live data -----------------------------------------------------------
  const watchlist = state.watchlist ?? DEFAULT_WATCHLIST;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [curve, setCurve] = useState<Series[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [draft, setDraft] = useState('');
  const [explained, setExplained] = useState<MoveExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => { void aiAvailable().then(setAiOn); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [dash, curveRes] = await Promise.all([fetchDashboard(watchlist), fetchCurve()]);
    if (dash.ok) {
      setQuotes(dash.quotes ?? []);
      setSeries(dash.series ?? []);
      setNews(dash.news ?? []);
      setDataError(null);
    } else {
      setDataError(dash.error ?? 'Market data unavailable.');
    }
    if (curveRes.ok) setCurve(curveRes.series ?? []);
    setLoading(false);
  }, [watchlist]);

  useEffect(() => { void load(); }, [load]);

  // Resolve any prediction whose horizon has passed, using the live price.
  useEffect(() => {
    if (quotes.length === 0) return;
    const due = (state.predictions ?? []).filter((p) => isDue(p));
    if (due.length === 0) return;
    const priceOf = (sym: string) => quotes.find((q) => q.symbol === sym)?.price;
    const resolved = due
      .map((p) => { const px = priceOf(p.symbol); return px ? resolve(p, px) : null; })
      .filter((p): p is Prediction => p !== null);
    if (resolved.length > 0) resolvePredictions(resolved);
  }, [quotes, state.predictions, resolvePredictions]);

  const tape = useMemo(
    () => TAPE_SERIES.map((id) => series.find((s) => s.id === id)).filter((s): s is Series => !!s),
    [series]
  );

  const curvePoints = useMemo(
    () => CURVE_ORDER
      .map((id) => ({ id, tenor: CURVE_LABEL[id], yield: curve.find((c) => c.id === id)?.latest?.value }))
      .filter((p): p is { id: string; tenor: string; yield: number } => p.yield !== undefined),
    [curve]
  );

  const cal = useMemo(() => calibration(state.predictions ?? []), [state.predictions]);
  const calNote = calibrationNote(cal);

  /** Turns a headline into a half-filled journal entry — the data entry was
      the reason the journal stayed empty. */
  const journalFromHeadline = (n: NewsItem) => setEditing({
    ...emptyEntry,
    date: new Date(n.datetime * 1000).toISOString().slice(0, 10),
    ticker: n.related?.split(',')[0] ?? '',
    event: n.headline,
    whatHappened: n.summary?.slice(0, 400) ?? '',
  });

  const runExplain = async () => {
    setExplaining(true);
    try {
      setExplained(await explainMove({
        date: today(),
        moves: [
          ...quotes.map((q) => ({ symbol: q.symbol, changePct: q.changePct })),
          ...tape.filter((s) => s.change !== undefined).map((s) => ({ symbol: s.label, changePct: s.change! })),
        ],
        headlines: news.slice(0, 10).map((n) => n.headline),
        userDraft: draft || undefined,
      }));
    } catch (e) {
      setDataError(e instanceof AiError ? e.message : 'Could not explain the moves.');
    } finally {
      setExplaining(false);
    }
  };

  const entries = useMemo(() => {
    return [...state.journal]
      .filter((e) => filter === 'all' || classesOf(e).includes(filter as AssetClass))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.journal, filter]);

  const save = (e: MarketJournalEntry) => {
    if (e.id) patch({ journal: state.journal.map((x) => (x.id === e.id ? e : x)) });
    else patch({ journal: [...state.journal, { ...e, id: uid('j-') }] });
    setEditing(null);
  };
  const remove = (id: string) => patch({ journal: state.journal.filter((e) => e.id !== id) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Markets Today</h1>
        <p className="text-sm text-slate-400">Don't just "read the news" — analyse it with a repeatable framework, then journal it.</p>
      </div>

      {dataError && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {dataError} The framework and journal below still work.
          </p>
        </Card>
      )}

      {/* Tape: watchlist quotes plus the headline macro series. */}
      <Card>
        <SectionTitle right={
          <button className="btn-ghost text-xs" disabled={loading} onClick={() => void load()}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        }>Tape</SectionTitle>
        {quotes.length === 0 && tape.length === 0 ? (
          <EmptyState>{loading ? 'Loading market data…' : 'No live data — check FINNHUB_API_KEY / FRED_API_KEY.'}</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {quotes.map((q) => (
              <div key={q.symbol}>
                <div className="text-xs font-semibold text-slate-500">{q.symbol}</div>
                <div className="text-lg font-bold">{q.price.toFixed(2)}</div>
                <div className={`text-xs font-medium ${q.changePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-400">{WATCHLIST_HINT[q.symbol] ?? ''}</div>
              </div>
            ))}
            {tape.map((sr) => (
              <div key={sr.id}>
                <div className="text-xs font-semibold text-slate-500">{sr.label}</div>
                <div className="text-lg font-bold">{formatSeriesValue(sr.id, sr.latest!.value)}</div>
                {sr.change !== undefined && (
                  <div className={`text-xs font-medium ${sr.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {sr.change >= 0 ? '+' : ''}{sr.change.toFixed(isPercentSeries(sr.id) ? 2 : 1)}
                    {isPercentSeries(sr.id) ? 'pp' : ''}
                  </div>
                )}
                <div className="text-[10px] text-slate-400">{sr.latest!.date}</div>
              </div>
            ))}
          </div>
        )}
        {quotes.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-400">
            Quotes from Finnhub; macro series from FRED, which publishes with a day or two of lag.
          </p>
        )}
      </Card>

      {/* Yield curve — the single most informative chart on the page. */}
      {curvePoints.length > 2 && (
        <Card>
          <SectionTitle>US Treasury curve</SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curvePoints} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" />
                <XAxis dataKey="tenor" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Yield']}
                />
                <Line type="monotone" dataKey="yield" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            const two = curvePoints.find((c) => c.id === 'DGS2')?.yield;
            const ten = curvePoints.find((c) => c.id === 'DGS10')?.yield;
            if (two === undefined || ten === undefined) return null;
            const spread = ten - two;
            return (
              <p className="mt-1 text-xs text-slate-500">
                2s10s is {spread >= 0 ? '+' : ''}{(spread * 100).toFixed(0)}bp —{' '}
                {spread < 0 ? 'inverted, which historically leads a slowdown.' : 'upward sloping.'}
              </p>
            );
          })()}
        </Card>
      )}

      {/* Headlines, each one click away from a half-written journal entry. */}
      {news.length > 0 && (
        <Card>
          <SectionTitle>Today's headlines</SectionTitle>
          <div className="space-y-2">
            {news.slice(0, 8).map((n) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                    {n.headline}
                  </a>
                  <div className="text-[10px] text-slate-400">
                    {n.source} · {new Date(n.datetime * 1000).toLocaleString()}
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={() => journalFromHeadline(n)}>
                  Journal this
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Write your own read first, then compare. */}
      {aiOn && (quotes.length > 0 || tape.length > 0) && (
        <Card>
          <SectionTitle>Explain today's moves</SectionTitle>
          <p className="text-xs text-slate-500">
            Write your causal chain first — comparing after you have committed is the part that teaches.
          </p>
          <textarea
            className="input mt-2 w-full"
            rows={3}
            placeholder="What do you think drove today's moves, and what would falsify that?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn-primary mt-2" disabled={explaining} onClick={() => void runExplain()}>
            {explaining ? 'Thinking…' : draft.trim() ? 'Compare with mine' : 'Show a read'}
          </button>
          {explained && (
            <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="label">Causal chain</span>
                <Chip tone={explained.confidence === 'high' ? 'finance' : 'academics'}>
                  {explained.confidence} confidence
                </Chip>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-slate-600 dark:text-slate-300">
                {explained.chain.map((c, i) => <li key={i}>{c}</li>)}
              </ol>
              {explained.watchNext?.length > 0 && (
                <div>
                  <span className="label">What would confirm or falsify it</span>
                  <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300">
                    {explained.watchNext.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {explained.critique && (
                <div>
                  <span className="label text-amber-600">On your read</span>
                  <p className="text-slate-600 dark:text-slate-300">{explained.critique}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Predictions: the journal's missing feedback loop. */}
      <PredictionPanel
        predictions={state.predictions ?? []}
        quotes={quotes}
        calibration={cal}
        note={calNote}
        onAdd={addPrediction}
      />

      {/* News source buttons */}
      <Card>
        <SectionTitle>Sources</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {NEWS_BUTTONS.map((b) => (
            <a key={b.label} href={b.url} target="_blank" rel="noreferrer" className="btn-ghost">{b.label} ↗</a>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">Priority: Bloomberg · Reuters · FT · CNBC · central banks · official releases. (Some require a subscription.)</p>
      </Card>

      {/* Analysis framework */}
      <Card>
        <SectionTitle>Daily analysis framework</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NEWS_ANALYSIS_FRAMEWORK.map((f) => (
            <div key={f.step} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{f.step}</span>
                <span className="text-sm font-semibold">{f.title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.prompt}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Market journal */}
      <Card>
        <SectionTitle right={<button className="btn-primary" onClick={() => setEditing({ ...emptyEntry, date: today() })}>+ New entry</button>}>Market Journal</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')} className={`chip ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>All</button>
          {ASSET_CLASSES.map((a) => (
            <button key={a} onClick={() => setFilter(a)} className={`chip capitalize ${filter === a ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{a}</button>
          ))}
        </div>
        {entries.length === 0 ? <EmptyState>No journal entries yet. After reading the news, record what happened and your explanation.</EmptyState> : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {classesOf(e).map((c) => <Chip key={c} tone="markets">{c}</Chip>)}
                    <span className="text-sm font-semibold">{e.ticker || '—'}</span>
                    <span className="text-xs text-slate-400">{e.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">confidence {e.confidence}/5</span>
                    <button className="text-xs text-indigo-500 hover:underline" onClick={() => setEditing(e)}>Edit</button>
                    <button className="text-xs text-red-400 hover:underline" onClick={() => remove(e.id)}>Delete</button>
                  </div>
                </div>
                <div className="mt-1 text-sm font-medium">{e.event}</div>
                <div className="mt-1 grid gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                  {e.whatHappened && <div><b>What: </b>{e.whatHappened}</div>}
                  {e.whyItHappened && <div><b>Why: </b>{e.whyItHappened}</div>}
                  {e.myPrediction && <div><b>My prediction: </b>{e.myPrediction}</div>}
                  {e.actualOutcome && <div><b>Actual: </b>{e.actualOutcome}</div>}
                  {e.lesson && <div className="sm:col-span-2 text-emerald-500"><b>Lesson: </b>{e.lesson}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit journal entry' : 'New journal entry'} wide>
        {editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Date"><input type="date" className="input" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="Confidence (1-5)"><input type="number" min={1} max={5} className="input" value={editing.confidence} onChange={(e) => setEditing({ ...editing, confidence: +e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Asset classes affected (select all that apply)">
                <div className="flex flex-wrap gap-1.5">
                  {ASSET_CLASSES.map((a) => {
                    const on = classesOf(editing).includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          const cur = classesOf(editing);
                          const next = on ? cur.filter((x) => x !== a) : [...cur, a];
                          setEditing({ ...editing, assetClasses: next });
                        }}
                        className={`chip capitalize ${on ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                      >
                        {on ? '✓ ' : ''}{a}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <Field label="Ticker / Asset"><input className="input" value={editing.ticker} onChange={(e) => setEditing({ ...editing, ticker: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Event"><input className="input" value={editing.event} onChange={(e) => setEditing({ ...editing, event: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="What happened?"><textarea className="input" value={editing.whatHappened} onChange={(e) => setEditing({ ...editing, whatHappened: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Why did it happen? (your explanation)"><textarea className="input" value={editing.whyItHappened} onChange={(e) => setEditing({ ...editing, whyItHappened: e.target.value })} /></Field></div>
            <Field label="My prediction"><textarea className="input" value={editing.myPrediction} onChange={(e) => setEditing({ ...editing, myPrediction: e.target.value })} /></Field>
            <Field label="What actually happened?"><textarea className="input" value={editing.actualOutcome} onChange={(e) => setEditing({ ...editing, actualOutcome: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Lesson"><textarea className="input" value={editing.lesson} onChange={(e) => setEditing({ ...editing, lesson: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" disabled={!editing.event} onClick={() => save(editing)}>Save entry</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predictions
//
// The journal has always asked "what do you think happens next" and never
// checked. A call with a direction, a horizon and the price at the time can be
// resolved automatically — which is what turns a diary into evidence about
// whether you can actually read a market.
// ---------------------------------------------------------------------------

function PredictionPanel({
  predictions, quotes, calibration: cal, note, onAdd,
}: {
  predictions: Prediction[];
  quotes: Quote[];
  calibration: ReturnType<typeof calibration>;
  note: string | null;
  onAdd: (p: Prediction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('SPY');
  const [direction, setDirection] = useState<Prediction['direction']>('up');
  const [horizon, setHorizon] = useState(5);
  const [confidence, setConfidence] = useState(0.6);
  const [rationale, setRationale] = useState('');

  const price = quotes.find((q) => q.symbol === symbol)?.price;
  const openCalls = predictions.filter((p) => !p.resolvedAt);
  const settled = predictions.filter((p) => p.resolvedAt);

  const submit = () => {
    if (!price) return;
    onAdd({
      id: uid('pr-'),
      date: today(),
      symbol,
      direction,
      horizonDays: horizon,
      resolveDate: addDays(today(), horizon),
      confidence,
      rationale,
      startPrice: price,
      // Anything under half a percent over the horizon is noise, not a call.
      flatBandPct: 0.5,
    });
    setOpen(false);
    setRationale('');
  };

  return (
    <Card>
      <SectionTitle right={
        <button className="btn-primary" disabled={quotes.length === 0} onClick={() => setOpen(true)}>
          + Make a call
        </button>
      }>Predictions</SectionTitle>

      {predictions.length === 0 ? (
        <EmptyState>
          No calls yet. A prediction with a direction and a horizon gets scored automatically once
          the horizon passes — that is the only way to find out if your reads are any good.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><div className="label">Open</div><div className="mt-1 text-2xl font-bold">{openCalls.length}</div></div>
            <div><div className="label">Resolved</div><div className="mt-1 text-2xl font-bold">{cal.resolved}</div></div>
            <div>
              <div className="label">Hit rate</div>
              <div className={`mt-1 text-2xl font-bold ${cal.accuracy >= 0.5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {cal.resolved ? `${Math.round(cal.accuracy * 100)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="label" title="Mean squared error of your stated confidence. Lower is better; 0.25 is what you get by always saying 50%.">
                Brier
              </div>
              <div className="mt-1 text-2xl font-bold">{cal.brier === null ? '—' : cal.brier.toFixed(3)}</div>
            </div>
          </div>

          {note && (
            <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {note}
            </p>
          )}

          {cal.buckets.length > 0 && (
            <div className="mt-3">
              <div className="label mb-1">Calibration — stated vs actual</div>
              <div className="space-y-1">
                {cal.buckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-slate-400">{b.label}</span>
                    <span className="w-10 text-right">{Math.round(b.actual * 100)}%</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                      <div className="h-full bg-indigo-500" style={{ width: `${b.actual * 100}%` }} />
                    </div>
                    <span className="w-8 text-slate-400">n={b.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            {[...openCalls, ...settled].slice(0, 10).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.symbol}</span>
                  <Chip tone={p.direction === 'up' ? 'academics' : p.direction === 'down' ? 'finance' : 'markets'}>
                    {p.direction}
                  </Chip>
                  <span className="text-slate-400">{Math.round(p.confidence * 100)}% · {p.horizonDays}d</span>
                  {p.resolvedAt ? (
                    <span className={p.correct ? 'font-semibold text-emerald-500' : 'font-semibold text-red-500'}>
                      {p.correct ? '✓ right' : '✗ wrong'} ({p.actualChangePct! >= 0 ? '+' : ''}{p.actualChangePct!.toFixed(2)}%)
                    </span>
                  ) : (
                    <span className="text-slate-400">resolves {p.resolveDate}</span>
                  )}
                </div>
                {p.rationale && <span className="w-full text-slate-500 sm:w-auto sm:max-w-md sm:truncate">{p.rationale}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Make a call">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <select className="input" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {quotes.map((q) => <option key={q.symbol} value={q.symbol}>{q.symbol}</option>)}
              </select>
            </Field>
            <Field label="Horizon (trading days)">
              <input className="input" type="number" min={1} max={90} value={horizon}
                     onChange={(e) => setHorizon(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>

          <Field label="Direction">
            <div className="flex gap-1.5">
              {(['up', 'flat', 'down'] as const).map((d) => (
                <button key={d} onClick={() => setDirection(d)}
                        className={`chip ${direction === d ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              A move smaller than 0.5% counts as flat, so a coin-flip call cannot be scored as right.
            </p>
          </Field>

          <Field label={`Confidence — ${Math.round(confidence * 100)}%`}>
            <input type="range" min={50} max={95} step={5} value={confidence * 100}
                   className="w-full"
                   onChange={(e) => setConfidence(Number(e.target.value) / 100)} />
            <p className="mt-1 text-[11px] text-slate-400">
              This is scored. Saying 90% and being right 60% of the time is what the Brier score catches.
            </p>
          </Field>

          <Field label="Why?">
            <textarea className="input" rows={3} value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="The mechanism, not the vibe." />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {price ? `Entry ${price.toFixed(2)} · resolves ${addDays(today(), horizon)}` : 'No live price for that symbol'}
            </span>
            <button className="btn-primary" disabled={!price || !rationale.trim()} onClick={submit}>
              Record it
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
