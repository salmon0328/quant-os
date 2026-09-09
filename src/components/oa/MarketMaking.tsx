import { useState } from 'react';
import { makingRound, settleMaking, idealSpread, type MakingRound, type MakingResult } from '../../engine/oaGames';
import { Card, SectionTitle } from '../ui';

const ROUNDS = 15;

interface Played {
  round: MakingRound;
  bid: number;
  ask: number;
  result: MakingResult;
}

/**
 * The market-making game every prop-trading interview runs.
 *
 * You quote a two-sided market on something you can reason about but not
 * observe. The counterparty is not random — it trades only when your quote is
 * wrong in its favour. That asymmetry is the whole lesson: a wide market is
 * safe but wins nothing, a tight market is only safe if your mid is right, and
 * being picked off costs exactly how wrong you were.
 */
export function MarketMaking({
  best,
  onDone,
}: {
  best: number | null;
  onDone: (pnl: number, rounds: number, ms: number) => void;
}) {
  const [round, setRound] = useState<MakingRound | null>(null);
  const [played, setPlayed] = useState<Played[]>([]);
  const [bid, setBid] = useState('');
  const [ask, setAsk] = useState('');
  const [last, setLast] = useState<Played | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [done, setDone] = useState(false);

  const pnl = played.reduce((a, p) => a + p.result.pnl, 0);

  const start = () => {
    setPlayed([]); setLast(null); setDone(false);
    setBid(''); setAsk('');
    setStartedAt(Date.now());
    setRound(makingRound());
  };

  const quote = () => {
    if (!round) return;
    const b = Number(bid);
    const a = Number(ask);
    if (!Number.isFinite(b) || !Number.isFinite(a)) return;

    const result = settleMaking(b, a, round.trueValue);
    const entry: Played = { round, bid: b, ask: a, result };
    const next = [...played, entry];
    setPlayed(next);
    setLast(entry);
    setBid(''); setAsk('');

    if (next.length >= ROUNDS) {
      setDone(true);
      setRound(null);
      onDone(next.reduce((acc, p) => acc + p.result.pnl, 0), next.length, Date.now() - startedAt);
      return;
    }
    setRound(makingRound());
  };

  if (done) {
    const traded = played.filter((p) => p.result.action !== 'none');
    const avgWidth = played.reduce((a, p) => a + (p.ask - p.bid), 0) / played.length;
    return (
      <Card>
        <SectionTitle>Session complete</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="label">P&amp;L</div>
            <div className={`mt-1 text-2xl font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}
            </div>
          </div>
          <div><div className="label">Picked off</div><div className="mt-1 text-2xl font-bold">{traded.length}<span className="text-sm font-normal text-slate-400">/{played.length}</span></div></div>
          <div><div className="label">Avg width</div><div className="mt-1 text-2xl font-bold">{avgWidth.toFixed(1)}</div></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {traded.length === 0 && avgWidth > 6
            ? 'You were never picked off, but your markets were very wide — safe and unprofitable. Try tightening until you start getting hit.'
            : traded.length > played.length * 0.6
              ? 'You were traded against on most rounds: your mids are off, not just your widths. Work on the estimate before the spread.'
              : 'A reasonable balance. The goal is a tight market whose mid is right, not a wide one nobody trades.'}
        </p>
        <button className="btn-primary mt-3" onClick={start}>Play again</button>
      </Card>
    );
  }

  if (!round) {
    return (
      <Card className="text-center">
        <div className="label mb-2">Market making</div>
        <p className="mx-auto max-w-lg text-sm text-slate-500 dark:text-slate-400">
          {ROUNDS} rounds. Each round you quote a two-sided market on a hidden quantity. A
          counterparty trades against you <em>only when your quote is wrong</em> — they lift your
          offer if fair is above it, and hit your bid if fair is below it. Quote too wide and you
          never trade; quote too tight with a bad mid and you bleed.
        </p>
        {best !== null && <p className="mt-2 text-xs text-slate-400">Best session P&amp;L: {best >= 0 ? '+' : ''}{best.toFixed(1)}</p>}
        <button className="btn-primary mt-3" onClick={start}>Start</button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Round {played.length + 1} / {ROUNDS}</span>
          <span className={pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
            P&amp;L {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}
          </span>
        </div>

        <div className="mt-3 text-base">
          Make a market on <span className="font-semibold">{round.prompt}</span>.
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Your bid (you buy here)</label>
            <input className="input font-mono" autoFocus value={bid} onChange={(e) => setBid(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') quote(); }} placeholder="e.g. 9" />
          </div>
          <div>
            <label className="label">Your ask (you sell here)</label>
            <input className="input font-mono" value={ask} onChange={(e) => setAsk(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') quote(); }} placeholder="e.g. 13" />
          </div>
        </div>
        <button className="btn-primary mt-3 w-full" disabled={!bid || !ask} onClick={quote}>
          Quote it
        </button>
      </Card>

      {last && (
        <Card className={last.result.pnl < 0 ? 'border-red-200 dark:border-red-500/30' : 'border-emerald-200 dark:border-emerald-500/30'}>
          <div className="text-sm">
            <span className="font-semibold">{last.bid} / {last.ask}</span>
            <span className="ml-2 text-slate-400">{last.round.description}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{last.result.note}</p>
          <p className="mt-1 text-xs text-slate-400">{idealSpread(last.round.trueValue, last.bid, last.ask)}</p>
        </Card>
      )}
    </div>
  );
}
