import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import type { Pillar } from '../models';

export function RadarProfile({ pillars, dark }: { pillars: Pillar[]; dark: boolean }) {
  const data = pillars.map((p) => ({ pillar: p.name.split(' ')[0], score: p.score, full: 100 }));
  const grid = dark ? '#334155' : '#e2e8f0';
  const text = dark ? '#94a3b8' : '#475569';
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke={grid} />
        <PolarAngleAxis dataKey="pillar" tick={{ fill: text, fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: text, fontSize: 9 }} stroke={grid} />
        <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
