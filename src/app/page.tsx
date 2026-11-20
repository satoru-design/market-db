"use client";

import React, { useState, useEffect } from 'react';
import { Gauge, Flame, TrendingDown } from 'lucide-react';
import { InsightTabs } from '@/components/InsightTabs';
import { FgStagePanel } from '@/components/FgStagePanel';
import { ScenarioCards } from '@/components/ScenarioCards';
import { detectPhase } from '@/lib/signals';

interface MarketData {
  fg: string;
  vix: string;
  skew: string;
}

export default function TerminalPage() {
  const [data, setData] = useState<MarketData>({ fg: '', vix: '', skew: '' });
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/market-data');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData({
          fg: json.fg ? json.fg.toString() : '',
          vix: json.vix ? json.vix.toFixed(2) : '',
          skew: json.skew ? json.skew.toFixed(2) : '',
        });
        setStatus('ready');
      } catch (err) {
        console.error('Failed to fetch market data', err);
        setStatus('error');
      }
    }
    fetchData();
  }, []);

  const indicators = (() => {
    const fg = parseFloat(data.fg);
    const vix = parseFloat(data.vix);
    const skew = parseFloat(data.skew);
    return !Number.isNaN(fg) && !Number.isNaN(vix) && !Number.isNaN(skew) ? { fg, vix, skew } : null;
  })();

  return (
    <div className="min-h-screen p-4 sm:p-8 lg:p-12 pb-24 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Gauge className="w-4 h-4" /> Fear &amp; Greed</h2>
            <div className="text-6xl font-black text-white py-6">{data.fg || '--'}</div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">CNN Auto-fetch</p>
          </div>
          <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Flame className="w-4 h-4" /> VIX Index</h2>
            <div className="text-6xl font-black text-white py-6">{data.vix || '--.--'}</div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Yahoo Finance Auto-fetch</p>
          </div>
          <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Skew Index</h2>
            <div className="text-6xl font-black text-white py-6">{data.skew || '---'}</div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Yahoo Finance Auto-fetch</p>
          </div>
        </div>

        <FgStagePanel
          fg={Number.isNaN(parseFloat(data.fg)) ? null : parseFloat(data.fg)}
          status={status}
          phase={indicators ? detectPhase(indicators) : null}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-black text-indigo-400 tracking-[0.2em] pl-2">相場が動いたら</h2>
          <ScenarioCards current={indicators ? detectPhase(indicators) : null} />
        </section>

        <InsightTabs indicators={indicators} />
      </div>
    </div>
  );
}
