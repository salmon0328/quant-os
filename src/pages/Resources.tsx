import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import { Card, SectionTitle, Chip, EmptyState } from '../components/ui';
import { RESOURCES } from '../data/resources';

const CATEGORIES = ['All', 'Finance', 'Reinforcement Learning', 'Programming', 'Algorithms', 'Machine Learning', 'Research', 'Finance Data', 'Market News'];

const ACCESS_LABEL: Record<string, { text: string; cls: string }> = {
  free: { text: 'Free', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  paywalled: { text: 'Paywalled $', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  ntu: { text: 'NTU library', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  owned: { text: 'I own the PDF', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
};

export default function Resources() {
  const { state, patch } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [diff, setDiff] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [editingPdf, setEditingPdf] = useState<string | null>(null);
  const [pdfDraft, setPdfDraft] = useState('');

  const list = useMemo(() => {
    return state.resources.filter((r) => {
      if (cat !== 'All' && r.category !== cat) return false;
      if (diff !== 'all' && r.difficulty !== diff) return false;
      if (onlyMine && !r.pdfLink) return false;
      if (q && !`${r.title} ${r.usefulFor} ${r.related.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [state.resources, q, cat, diff, onlyMine]);

  const setProgress = (id: string, v: number) => {
    patch({ resources: state.resources.map((r) => (r.id === id ? { ...r, progress: v } : r)) });
  };
  const savePdf = (id: string, link: string) => {
    patch({ resources: state.resources.map((r) => (r.id === id ? { ...r, pdfLink: link.trim() || undefined, access: link.trim() ? 'owned' : r.access } : r)) });
    setEditingPdf(null);
  };

  const withPdf = state.resources.filter((r) => r.pdfLink).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Resource Library</h1>
        <p className="text-sm text-slate-400">Verified official sources only. Attach your own PDF links to build a single library index. {RESOURCES.length} resources · {withPdf} linked to your PDFs.</p>
      </div>

      {/* How to consolidate PDFs */}
      <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/10">
        <SectionTitle>Consolidating your PDFs</SectionTitle>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Rather than store large files in the browser, keep the PDFs in <b>one cloud folder</b> and paste a shareable link into each resource below.
          Recommended: your <b>NTU OneDrive / Google Drive</b> (free with your student account) — upload all books to a folder like <code>/Quant-OS Library</code>,
          set sharing to "anyone with the link", then use <b>+ Add my PDF</b> on each card. Links persist locally and turn the tag violet ("I own the PDF").
          For the books you own (Hull, Chan, López de Prado) this replaces the paywall tag.
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[200px]" placeholder="Search resources, topics…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={diff} onChange={(e) => setDiff(e.target.value)}>
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <button onClick={() => setOnlyMine(!onlyMine)} className={`btn ${onlyMine ? 'btn-primary' : 'btn-ghost'}`}>My library</button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-800 hover:text-indigo-500 dark:text-slate-100">{r.title}</a>
              <span className={`chip ${ACCESS_LABEL[r.access].cls}`}>{ACCESS_LABEL[r.access].text}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip>{r.category}</Chip>
              <span className="text-[10px] uppercase text-slate-400">{r.difficulty}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400"><b>Useful for:</b> {r.usefulFor}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><b>When:</b> {r.whenToUse}</p>
            {r.related.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.related.map((t) => <span key={t} className="text-[10px] text-indigo-400">↔ {t}</span>)}</div>}

            {/* My PDF */}
            <div className="mt-3 rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
              {editingPdf === r.id ? (
                <div className="flex gap-2">
                  <input autoFocus className="input" placeholder="Paste Drive/OneDrive/library link…" value={pdfDraft} onChange={(e) => setPdfDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePdf(r.id, pdfDraft)} />
                  <button className="btn-primary" onClick={() => savePdf(r.id, pdfDraft)}>Save</button>
                </div>
              ) : r.pdfLink ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <a href={r.pdfLink} target="_blank" rel="noreferrer" className="truncate font-medium text-violet-500 hover:underline">📄 Open my PDF ↗</a>
                  <button className="text-slate-400 hover:underline" onClick={() => { setEditingPdf(r.id); setPdfDraft(r.pdfLink ?? ''); }}>Edit</button>
                </div>
              ) : (
                <button className="text-xs text-violet-500 hover:underline" onClick={() => { setEditingPdf(r.id); setPdfDraft(''); }}>+ Add my PDF link</button>
              )}
            </div>

            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>My progress</span><span>{r.progress ?? 0}%</span></div>
              <input type="range" min={0} max={100} step={10} value={r.progress ?? 0} onChange={(e) => setProgress(r.id, +e.target.value)} className="w-full accent-indigo-500" />
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && <EmptyState>No resources match your filters.</EmptyState>}
    </div>
  );
}
