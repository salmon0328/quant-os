/**
 * Minimal prose renderer for generated lesson text: blank-line separated
 * paragraphs, and lines starting with "- " become a bullet list. Extracted from
 * the old Learn page so the module reader and anything else can share it.
 */
type Block = { type: 'p' | 'ul'; items: string[] };

function toBlocks(text: string): Block[] {
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((para): Block => {
      const lines = para.split('\n');
      if (lines.length > 1 && lines.every((l) => /^[-*]\s/.test(l.trim()))) {
        return { type: 'ul', items: lines.map((l) => l.trim().replace(/^[-*]\s/, '')) };
      }
      return { type: 'p', items: [para] };
    });
}

export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {toBlocks(text).map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {b.items[0]}
          </p>
        )
      )}
    </div>
  );
}
