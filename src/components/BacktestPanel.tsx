"use client";
import { useEffect, useState } from 'react';
import type { BacktestResult } from '@/lib/backtest';

export function BacktestPanel() {
  const [results, setResults] = useState<BacktestResult[]>([]);

  useEffect(() => {
    fetch('/api/backtest').then(r => r.json()).then(setResults);
  }, []);

  return (
    <div className="max-w-7xl mx-auto mt-12 pb-12">
      <h2 className="text-sm font-black text-emerald-400 uppercase tracking-[0.3em] pl-2 mb-4">
        DCA Backtest (発火日に買付 → 現在のリターン)
      </h2>
      <div className="glass-card rounded-3xl p-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
            <tr>
              <th className="p-3">Ticker</th>
              <th className="p-3 text-right">平均リターン</th>
              <th className="p-3 text-right">勝率</th>
              <th className="p-3 text-right">サンプル数</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.ticker} className="border-t border-white/5">
                <td className="p-3 font-black text-indigo-300">{r.ticker}</td>
                <td className={`p-3 text-right font-mono font-bold ${r.byEvent.length === 0 ? 'text-slate-500' : r.avgReturnPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(r.avgReturnPct * 100).toFixed(1)}%
                </td>
                <td className="p-3 text-right font-mono">{(r.winRate * 100).toFixed(0)}%</td>
                <td className="p-3 text-right font-mono text-slate-500">{r.byEvent.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
