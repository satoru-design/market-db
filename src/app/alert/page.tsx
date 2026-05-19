"use client";
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { detectPhase, type Phase } from '@/lib/signals';
import type { BacktestResult } from '@/lib/backtest';

const eventLabels: Record<string, string> = {
  vix_spike: 'VIX SPIKE (>30)',
  fg_panic: 'F&G PANIC (<20)',
  skew_high: 'SKEW HIGH (>150)',
  phase_change: 'PHASE CHANGE',
};

type MarketData = {
  fg?: number | string;
  vix?: number | string;
  skew?: number | string;
};

function AlertContent() {
  const params = useSearchParams();
  const event = params.get('event') ?? 'unknown';
  const [data, setData] = useState<MarketData | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult[]>([]);

  useEffect(() => {
    fetch('/api/market-data').then(r => r.json()).then(setData);
    fetch('/api/backtest').then(r => r.json()).then(setBacktest);
  }, []);

  let phase: Phase | null = null;
  if (data) {
    const fg = typeof data.fg === 'number' ? data.fg : parseFloat(String(data.fg));
    const vix = typeof data.vix === 'number' ? data.vix : parseFloat(String(data.vix));
    const skew = typeof data.skew === 'number' ? data.skew : parseFloat(String(data.skew));
    if (!Number.isNaN(fg) && !Number.isNaN(vix) && !Number.isNaN(skew)) {
      phase = detectPhase({ fg, vix, skew });
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-6 text-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs text-red-400 uppercase font-black tracking-widest mb-2">🚨 ALERT FIRED</div>
        <h1 className="text-3xl font-black mb-1">{eventLabels[event] ?? event}</h1>
        <div className="text-sm text-slate-500">{new Date().toLocaleString('ja-JP')}</div>
      </div>

      {data && (
        <div className="max-w-3xl mx-auto glass-card rounded-2xl p-6">
          <div className="text-xs uppercase text-slate-500 font-black mb-3">現在指標</div>
          <div className="grid grid-cols-3 gap-4 font-mono">
            <div><div className="text-xs text-slate-500">F&amp;G</div><div className="text-2xl font-black">{data.fg ?? '--'}</div></div>
            <div><div className="text-xs text-slate-500">VIX</div><div className="text-2xl font-black">{data.vix ?? '--'}</div></div>
            <div><div className="text-xs text-slate-500">Skew</div><div className="text-2xl font-black">{data.skew ?? '--'}</div></div>
          </div>
          {phase && <div className="mt-4 text-emerald-400 font-black uppercase tracking-wider">→ Phase: {phase}</div>}
        </div>
      )}

      {backtest.length > 0 && (
        <div className="max-w-3xl mx-auto glass-card rounded-2xl p-6">
          <div className="text-xs uppercase text-slate-500 font-black mb-3">過去発火後リターン（参考）</div>
          <div className="space-y-2 font-mono text-sm">
            {backtest.slice(0, 5).map(r => (
              <div key={r.ticker} className="flex justify-between">
                <span className="text-indigo-300 font-black">{r.ticker}</span>
                <span className={r.byEvent.length === 0 ? 'text-slate-500' : r.avgReturnPct > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  Avg {(r.avgReturnPct * 100).toFixed(1)}% / 勝率 {(r.winRate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto text-center">
        <Link href="/" className="text-sm text-slate-500 uppercase font-black tracking-widest">▼ Daily Briefing に戻る</Link>
      </div>
    </div>
  );
}

export default function AlertPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <AlertContent />
    </Suspense>
  );
}
