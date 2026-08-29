import { useState } from 'react';
import { LEARNING_TRACKS } from '../data/learningTracks';
import { useApp } from '../store/AppState';
import { Card, ProgressBar, Chip } from '../components/ui';
import { PILLARS } from '../data/pillars';

export default function Learn() {
  const { state, patch } = useApp();
  const [active, setActive] = useState(LEARNING_TRACKS[0].pillar);
  const track = LEARNING_TRACKS.find((t) => t.pillar === active)!;
  const pillar = PILLARS.find((p) => p.id === active)!;

  const key = (topic: string) => `${active}:${topic}`;
  const isDone = (topic: string) => !!state.learnProgress[key(topic)];
  const toggle = (topic: string) => patch({ learnProgress: { ...state.learnProgress, [key(topic)]: !isDone(topic) } });

  const allTopics = track.stages.flatMap((s) => s.topics);
  const doneCount = allTopics.filter(isDone).length;
  const pct = Math.round((doneCount / allTopics.length) * 100);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Learn</h1>
        <p className="text-sm text-slate-400">Progressive learning tracks. Resources are recommended step-by-step — no advanced papers thrown at you early.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEARNING_TRACKS.map((t) => {
          const p = PILLARS.find((x) => x.id === t.pillar)!;
          return (
            <button key={t.pillar} onClick={() => setActive(t.pillar)} className={`btn ${active === t.pillar ? 'text-white' : 'btn-ghost'}`} style={active === t.pillar ? { background: p.color } : {}}>
              {t.title.split(' ')[0]}
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: pillar.color }}>{track.title}</h2>
            <p className="text-xs text-slate-400">{pillar.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: pillar.color }}>{pct}%</div>
            <div className="text-xs text-slate-400">{doneCount}/{allTopics.length} topics</div>
          </div>
        </div>
        <div className="mt-3"><ProgressBar value={pct} color={pillar.color} /></div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {track.stages.map((stage, i) => {
          const done = stage.topics.filter(isDone).length;
          return (
            <Card key={stage.name}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: pillar.color }}>{i + 1}</span>
                  <h3 className="font-semibold">{stage.name}</h3>
                </div>
                <Chip>{done}/{stage.topics.length}</Chip>
              </div>
              <div className="space-y-1">
                {stage.topics.map((topic) => (
                  <label key={topic} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={isDone(topic)} onChange={() => toggle(topic)} className="accent-indigo-500" />
                    <span className={isDone(topic) ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>{topic}</span>
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
