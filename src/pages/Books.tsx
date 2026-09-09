import { useMemo, useState } from 'react';
import { useApp } from '../store/AppState';
import {
  BOOKS, BOOK_CATEGORY_LABEL, chaptersOf, hasChapters, percentDone, playBooksUrl,
  EMPTY_BOOK_PROGRESS, type Book, type BookCategory,
} from '../data/books';
import type { BookProgress, BookStatus } from '../models';
import { Card, SectionTitle, Chip, Modal, Field, ProgressBar, EmptyState } from '../components/ui';
import { today } from '../lib/date';

const STATUS_LABEL: Record<BookStatus, string> = {
  unread: 'Not started',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Put down',
};

export default function Books() {
  const { state, setBookProgress, tickChapter } = useApp();
  const progress = state.bookProgress ?? {};
  const [open, setOpen] = useState<Book | null>(null);
  const [filter, setFilter] = useState<BookCategory | 'all'>('all');

  const reading = BOOKS.filter((b) => progress[b.id]?.status === 'reading');

  const grouped = useMemo(() => {
    const map = new Map<BookCategory, Book[]>();
    for (const b of BOOKS) {
      if (filter !== 'all' && b.category !== filter) continue;
      const rows = map.get(b.category) ?? [];
      rows.push(b);
      map.set(b.category, rows);
    }
    for (const rows of map.values()) rows.sort((a, b) => a.priority - b.priority);
    return [...map.entries()];
  }, [filter]);

  const finished = BOOKS.filter((b) => progress[b.id]?.status === 'finished').length;
  const chaptersRead = Object.values(progress).reduce((a, p) => a + (p.chaptersDone?.length ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Books</h1>
        <p className="text-sm text-slate-400">
          The reading list, tracked chapter by chapter. Chapters ticked here are the same ones the
          planner schedules, so the two never disagree.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="label">Finished</div><div className="mt-1 text-2xl font-bold text-emerald-500">{finished}<span className="text-sm font-normal text-slate-400">/{BOOKS.length}</span></div></Card>
        <Card><div className="label">Currently reading</div><div className="mt-1 text-2xl font-bold text-indigo-500">{reading.length}</div></Card>
        <Card><div className="label">Chapters read</div><div className="mt-1 text-2xl font-bold">{chaptersRead}</div></Card>
      </div>

      {reading.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <SectionTitle>On the go</SectionTitle>
          <div className="space-y-3">
            {reading.map((b) => {
              const p = progress[b.id];
              const pct = percentDone(b, p);
              return (
                <button key={b.id} onClick={() => setOpen(b)} className="block w-full text-left">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{b.title}</span>
                    <span className="font-mono text-xs text-slate-400">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} />
                  <div className="mt-1 text-[11px] text-slate-400">
                    {hasChapters(b.id)
                      ? `${p?.chaptersDone.length ?? 0} of ${chaptersOf(b.id).length} chapters`
                      : p?.currentPage ? `page ${p.currentPage}${b.pages ? ` of ${b.pages}` : ''}` : 'no page recorded yet'}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')} className={`chip ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All ({BOOKS.length})</button>
        {(Object.keys(BOOK_CATEGORY_LABEL) as BookCategory[]).map((c) => {
          const n = BOOKS.filter((b) => b.category === c).length;
          return (
            <button key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {BOOK_CATEGORY_LABEL[c]} ({n})
            </button>
          );
        })}
      </div>

      {grouped.length === 0 && <EmptyState>No books in that category.</EmptyState>}

      {grouped.map(([category, books]) => (
        <Card key={category}>
          <SectionTitle>{BOOK_CATEGORY_LABEL[category]}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {books.map((b) => {
              const p = progress[b.id];
              const pct = percentDone(b, p);
              return (
                <button
                  key={b.id}
                  onClick={() => setOpen(b)}
                  className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:shadow-sm dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800 dark:text-slate-100">{b.title}</div>
                      <div className="truncate text-xs text-slate-400">{b.author}</div>
                    </div>
                    {p?.status === 'finished' && <span className="text-emerald-500">✓</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{b.why}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone={b.priority === 1 ? 'finance' : 'academics'}>P{b.priority}</Chip>
                    <span className="text-[10px] text-slate-400">~{b.estHours}h</span>
                    {b.freeUrl && <span className="text-[10px] font-semibold text-emerald-500">FREE</span>}
                    {p?.playBooksVolumeId && <span className="text-[10px] text-indigo-400">Play Books</span>}
                  </div>
                  {pct > 0 && <div className="mt-2"><ProgressBar value={pct} /></div>}
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <BookModal
        book={open}
        progress={open ? progress[open.id] : undefined}
        onClose={() => setOpen(null)}
        onPatch={(patch) => open && setBookProgress(open.id, patch)}
        onTickChapter={(n) => open && tickChapter(open.id, n)}
      />
    </div>
  );
}

function BookModal({
  book, progress, onClose, onPatch, onTickChapter,
}: {
  book: Book | null;
  progress: BookProgress | undefined;
  onClose: () => void;
  onPatch: (patch: Partial<BookProgress>) => void;
  onTickChapter: (chapter: number) => void;
}) {
  if (!book) return null;
  const p = progress ?? EMPTY_BOOK_PROGRESS;
  const chapters = chaptersOf(book.id);
  const pct = percentDone(book, p);

  return (
    <Modal open onClose={onClose} title={book.title} wide>
      <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <div className="text-sm text-slate-400">{book.author}</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{book.why}</p>
          <p className="mt-1 text-xs italic text-slate-500">{book.whenToRead}</p>
          {book.note && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {book.note}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABEL) as BookStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onPatch({
                status: s,
                ...(s === 'reading' && !p.startedAt ? { startedAt: today() } : {}),
                ...(s === 'finished' ? { finishedAt: today() } : {}),
              })}
              className={`chip ${p.status === s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">Progress</span>
            <span className="font-mono text-xs text-slate-400">{pct}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>

        {/* Links: publisher, a genuinely free copy where one exists, your own
            upload, and your library. Never a pirated source. */}
        <div className="flex flex-wrap gap-2">
          {book.freeUrl && (
            <a className="btn-primary" href={book.freeUrl} target="_blank" rel="noreferrer">Read free (official) ↗</a>
          )}
          {p.playBooksVolumeId && (
            <a className="btn-primary" href={playBooksUrl(p.playBooksVolumeId)} target="_blank" rel="noreferrer">
              Open in Play Books ↗
            </a>
          )}
          {p.myLink && <a className="btn-ghost" href={p.myLink} target="_blank" rel="noreferrer">My copy ↗</a>}
          {book.publisherUrl && (
            <a className="btn-ghost" href={book.publisherUrl} target="_blank" rel="noreferrer">Publisher ↗</a>
          )}
          <a
            className="btn-ghost"
            href={`https://www.ntu.edu.sg/library?q=${encodeURIComponent(book.title)}`}
            target="_blank"
            rel="noreferrer"
          >
            NTU library ↗
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Google Play Books volume id">
            <input
              className="input"
              placeholder="from play.google.com/books/reader?id=…"
              value={p.playBooksVolumeId ?? ''}
              onChange={(e) => onPatch({ playBooksVolumeId: e.target.value.trim() || undefined })}
            />
          </Field>
          <Field label="My copy (Drive / library link)">
            <input
              className="input"
              placeholder="https://…"
              value={p.myLink ?? ''}
              onChange={(e) => onPatch({ myLink: e.target.value.trim() || undefined })}
            />
          </Field>
        </div>
        <p className="-mt-2 text-[11px] text-slate-400">
          Upload the PDF to Play Books yourself, open it, and copy the <code>id=</code> value out of
          the reader URL. That gives you the page-flip reader on any device, and this card becomes a
          one-tap way back into it.
        </p>

        {chapters.length > 0 ? (
          <div>
            <div className="label mb-2">
              Chapters — {p.chaptersDone.length} of {chapters.length}
            </div>
            <div className="space-y-1">
              {chapters.map((c) => {
                const done = p.chaptersDone.includes(c.chapter);
                return (
                  <button
                    key={c.id}
                    onClick={() => onTickChapter(c.chapter)}
                    className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-sm transition ${done ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-slate-200 hover:border-indigo-400 dark:border-slate-800'}`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {done && '✓'}
                    </span>
                    <span className="min-w-0">
                      <span className={done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>
                        Ch.{c.chapter} — {c.title}
                      </span>
                      <span className="block text-[11px] text-slate-400">{c.concepts.join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Field label={`Current page${book.pages ? ` (of ~${book.pages})` : ''}`}>
            <input
              className="input"
              type="number"
              min={0}
              max={book.pages}
              value={p.currentPage ?? ''}
              onChange={(e) => onPatch({ currentPage: Number(e.target.value) || undefined })}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              This book is not in the planner's chapter rotation, so progress is tracked by page.
            </p>
          </Field>
        )}

        {p.status === 'finished' && (
          <Field label="Rating (1-5)">
            <input
              className="input"
              type="number"
              min={1}
              max={5}
              value={p.rating ?? ''}
              onChange={(e) => onPatch({ rating: Number(e.target.value) || undefined })}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
