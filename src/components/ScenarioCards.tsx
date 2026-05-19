"use client";

import { neighborPhases } from '@/lib/scenarios';
import type { Phase } from '@/lib/signals';
import { portfolioData } from '@/data/portfolio';

const labels: Record<Phase, { text: string; color: string }> = {
  HEAT: { text: '利益確定', color: 'bg-red-600' },
  PERFECT: { text: '全力買付', color: 'bg-emerald-600' },
  HIGH: { text: '強気スポット', color: 'bg-emerald-500' },
  WATCH: { text: '打診買い', color: 'bg-indigo-500' },
  NEUTRAL: { text: '静観', color: 'bg-slate-600' },
};

function PhaseCard({ phase, role }: { phase: Phase; role: '1段悪化' | '現状' | '1段改善' }) {
  const label = labels[phase];
  const totalBudget = portfolioData.reduce((sum, cat) => {
    const b = cat.strategy[phase]?.budget?.match(/(\d+)万円/);
    return sum + (b ? parseInt(b[1], 10) : 0);
  }, 0);

  return (
    <div className={`glass-card rounded-2xl p-6 border-t-4 ${role === '現状' ? 'border-t-indigo-400 ring-2 ring-indigo-500/30' : 'border-t-slate-700'}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">{role}</div>
      <div className={`inline-block ${label.color} text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded mb-3`}>{phase}</div>
      <div className="text-lg font-black text-slate-200 mb-2">{label.text}</div>
      <div className="text-[10px] text-slate-500 uppercase font-bold">月配分合計</div>
      <div className="text-2xl font-mono font-black text-emerald-400">{totalBudget}万円</div>
    </div>
  );
}

export function ScenarioCards({ current }: { current: Phase }) {
  const { worse, better } = neighborPhases(current);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {worse && <PhaseCard phase={worse} role="1段悪化" />}
      <PhaseCard phase={current} role="現状" />
      {better && <PhaseCard phase={better} role="1段改善" />}
    </div>
  );
}
