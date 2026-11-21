"use client";

import React, { useState, useEffect } from 'react';
import { Gauge, Flame, TrendingDown } from 'lucide-react';
import { InsightTabs } from '@/components/InsightTabs';
import { FgStagePanel } from '@/components/FgStagePanel';
import { ScenarioCards } from '@/components/ScenarioCards';
import { CashPoolPanel } from '@/components/CashPoolPanel';
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
        {/* 2026-11-21 小池「1画面が指標で埋まるので勿体ない」→ スマホでも3つを横1列・低い帯にした。
            一番見たいのは下の「今買うもの」なので、指標は1画面の上の方に収める。 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="indicator-strip">
          {[
            { label: 'F&G', icon: Gauge, value: data.fg || '--', src: 'CNN' },
            { label: 'VIX', icon: Flame, value: data.vix || '--.--', src: 'Yahoo Finance' },
            { label: 'SKEW', icon: TrendingDown, value: data.skew || '---', src: 'Yahoo Finance' },
          ].map(({ label, icon: Icon, value, src }) => (
            <div key={label} className="glass-card rounded-2xl px-2 py-3 sm:p-5 flex flex-col items-center justify-center" title={`${src}から自動で取得`}>
              <h2 className="text-[11px] sm:text-xs font-black text-slate-400 tracking-widest flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</h2>
              <div className="text-2xl sm:text-4xl font-black text-white mt-1 tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 -mt-4 sm:-mt-3 pl-1">
          {status === 'error' ? '指標が取れませんでした。少し待って開き直してください。' : 'F&GはCNN、VIXとSKEWはYahoo Financeから自動で取得しています。'}
        </p>

        {/* 2026-11-21 小池: 指標のすぐ下に「今何を買うか」を置く。段階の表はその根拠なので後ろ。 */}
        <CashPoolPanel
          phase={indicators ? detectPhase(indicators) : null}
          fg={Number.isNaN(parseFloat(data.fg)) ? null : parseFloat(data.fg)}
        />

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
