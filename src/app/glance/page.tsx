"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { detectPhase, type Phase } from '@/lib/signals';

const labels: Record<Phase, { text: string; color: string }> = {
  HEAT: { text: '利益確定', color: 'bg-red-600' },
  PERFECT: { text: '全力買付', color: 'bg-emerald-600' },
  HIGH: { text: '強気スポット', color: 'bg-emerald-500' },
  WATCH: { text: '打診買い', color: 'bg-indigo-500' },
  NEUTRAL: { text: '静観', color: 'bg-slate-600' },
};

type MarketData = {
  fg?: number | string;
  vix?: number | string;
  skew?: number | string;
  yield?: number | null;
  dxy?: number | null;
  gold?: number | null;
  silver?: number | null;
};

export default function GlancePage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [phase, setPhase] = useState<Phase>('NEUTRAL');

  useEffect(() => {
    fetch('/api/market-data').then(r => r.json()).then((d: MarketData) => {
      setData(d);
      const fg = typeof d.fg === 'number' ? d.fg : parseFloat(String(d.fg));
      const vix = typeof d.vix === 'number' ? d.vix : parseFloat(String(d.vix));
      const skew = typeof d.skew === 'number' ? d.skew : parseFloat(String(d.skew));
      if (!Number.isNaN(fg) && !Number.isNaN(vix) && !Number.isNaN(skew)) {
        setPhase(detectPhase({ fg, vix, skew }));
      }
    });
  }, []);

  const label = labels[phase];

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4 text-slate-100">
      <div className={`${label.color} rounded-2xl p-8 text-center`}>
        <div className="text-xs font-black uppercase tracking-widest opacity-80">{phase}</div>
        <div className="text-4xl font-black mt-2">{label.text}</div>
      </div>
      {data && (
        <div className="glass-card rounded-2xl p-6 space-y-2 font-mono">
          <div className="flex justify-between"><span className="text-slate-500">F&G</span><span className="font-black text-xl">{data.fg ?? '--'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">VIX</span><span className="font-black text-xl">{data.vix ?? '--'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Skew</span><span className="font-black text-xl">{data.skew ?? '--'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">10Y</span><span className="font-black text-xl">{data.yield ?? '--'}</span></div>
        </div>
      )}
      <Link href="/" className="text-center text-xs text-slate-500 uppercase font-black tracking-widest py-4">▼ Daily Briefing 詳細を見る</Link>
    </div>
  );
}
