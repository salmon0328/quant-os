import React, { useEffect } from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{children}</h2>
      {right}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="label mb-1">{children}</div>;
}

const CHIP_COLORS: Record<string, string> = {
  academics: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  programming: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  ai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  finance: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  research: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  career: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  markets: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  technical: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  output: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  review: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  default: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

export function Chip({ tone = 'default', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`chip ${CHIP_COLORS[tone] ?? CHIP_COLORS.default}`}>{children}</span>;
}

export function ProgressBar({ value, color = '#6366f1' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
