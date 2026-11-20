"use client";

import { neighborPhases } from '@/lib/scenarios';
import type { Phase } from '@/lib/signals';
import { DEPLOY } from '@/lib/buy-action';

// 今のフェーズと、相場がもう1段下げた時・1段戻した時に、弾薬をどれだけ出すかを並べる。
// 2026-11-21 トップページに戻した（小池）。表示する数は DEPLOY（通知と同じ正本）から出す。

const labels: Record<Phase, { text: string; color: string }> = {
  HEAT: { text: '過熱。利確して弾薬に戻す', color: 'bg-red-600' },
  PERFECT: { text: '総悲観。最大の買い場', color: 'bg-emerald-600' },
  HIGH: { text: '押し目買い', color: 'bg-emerald-500' },
  WATCH: { text: '下落の入口。打診枠だけ', color: 'bg-indigo-500' },
  NEUTRAL: { text: '通常。積立だけ', color: 'bg-slate-600' },
};

type Role = 'もう1段下げたら' | '今' | '1段戻したら';

function PhaseCard({ phase, role }: { phase: Phase; role: Role }) {
  const label = labels[phase];
  const d = DEPLOY[phase];
  const out = Math.round((d.core + d.leverage) * 100);
  const howOut = phase === 'HEAT'
    ? '新しく買わない'
    : phase === 'PERFECT' ? '主力・守り・戻りは一括、3倍ブルは4回に分ける'
    : phase === 'HIGH' ? '3回に分けて5営業日ごと'
    : phase === 'WATCH' ? '目標残高。入れてあれば追加なし'
    : '出さない';

  return (
    <div className={`glass-card rounded-2xl p-6 border-t-4 ${role === '今' ? 'border-t-indigo-400 ring-2 ring-indigo-500/30' : 'border-t-slate-700'}`}>
      <div className="text-xs text-slate-400 font-black mb-2">{role}</div>
      <div className={`inline-block ${label.color} text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded mb-3`}>{phase}</div>
      <div className="text-lg font-black text-slate-200 mb-3">{label.text}</div>
      <div className="text-xs text-slate-400 font-bold">弾薬から出す割合</div>
      <div className="text-3xl font-mono font-black text-emerald-400">{out}%</div>
      <div className="text-sm text-slate-300 mb-2">{howOut}</div>
      <div className={`text-sm ${d.leverage > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
        3倍ブル：{d.leverage > 0 ? `弾薬の${Math.round(d.leverage * 100)}%（上の割合に含む）` : '買わない'}
      </div>
    </div>
  );
}

// 端のフェーズでは隣が無い。枠ごと消すと3列が崩れて「壊れた」ように見えるので、理由を書いて残す。
function EdgeCard({ role, text }: { role: Role; text: string }) {
  return (
    <div className="glass-card rounded-2xl p-6 border-t-4 border-t-slate-800 opacity-60">
      <div className="text-xs text-slate-400 font-black mb-2">{role}</div>
      <div className="text-sm text-slate-400">{text}</div>
    </div>
  );
}

export function ScenarioCards({ current }: { current: Phase | null }) {
  if (!current) {
    return (
      <div className="glass-card rounded-2xl p-6 text-sm text-slate-400">
        指標を取得しています。揃うと、今のフェーズと前後のフェーズがここに並びます。
      </div>
    );
  }
  const { worse, better } = neighborPhases(current);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {worse
        ? <PhaseCard phase={worse} role="もう1段下げたら" />
        : <EdgeCard role="もう1段下げたら" text="今がいちばん深い段階です。これより下のフェーズはありません。" />}
      <PhaseCard phase={current} role="今" />
      {better
        ? <PhaseCard phase={better} role="1段戻したら" />
        : <EdgeCard role="1段戻したら" text="今がいちばん過熱した段階です。これより上のフェーズはありません。" />}
    </div>
  );
}
