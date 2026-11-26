"use client";

import { useEffect, useState } from 'react';
import type { Phase } from '@/lib/signals';
import { planOrder, tranchesFor, SAFETY_MARGIN, type Bucket, type Tranche } from '@/lib/share-plan';

// 弾薬の額から、1回の注文で「どの銘柄を何株」買うかを出す表。計算の正本は lib/share-plan.ts。
// 比べて読む表なので、狭い画面でもカードに崩さず横に送る。

type Quotes = { usdjpy: number | null; prices: Record<string, number | null>; asOf: string | null };
type Load = 'loading' | 'error' | 'ready';

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`;

const ROLE: Record<Bucket, string> = { main: '主力', def: '守り', rebound: '戻り', leverage: '3倍ブル' };

function howOften(t: Tranche, phase: Phase): string {
  if (t.kind === 'leverage') return '同じ注文を4回、3営業日ごとに指値で入れます。一括では買いません。';
  if (phase === 'HIGH') return '同じ注文を3回、5営業日ごとに入れます（下げた日に指値）。';
  if (phase === 'WATCH') return '打診枠です。すでに入れてあれば追加しません。';
  return '一括で入れます。';
}

function OrderTable({ t, priceYen, phase }: { t: Tranche; priceYen: Record<string, number | null>; phase: Phase }) {
  const plan = planOrder(t.budgetYen, t.buckets, priceYen);
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-200 font-bold">
        {t.kind === 'leverage' ? '3倍ブル' : '主力・守り・戻り'}：1回{yen(t.budgetYen)}
        <span className="text-slate-400 font-normal">（{howOften(t, phase)}）</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 pr-3 font-bold">銘柄</th>
              <th className="text-right py-2 pr-3 font-bold">買う数</th>
              <th className="text-right py-2 pr-3 font-bold">金額</th>
              <th className="text-right py-2 pr-3 font-bold">1株（円）</th>
              <th className="text-right py-2 font-bold">目安</th>
            </tr>
          </thead>
          <tbody>
            {plan.etfs.map(l => (
              <tr key={l.ticker} className="border-b border-slate-800">
                <td className="py-2 pr-3">
                  <div className="font-mono font-black text-white">{l.ticker}</div>
                  <div className="text-xs text-slate-400">{ROLE[l.bucket]}</div>
                </td>
                <td className={`py-2 pr-3 text-right font-mono font-black whitespace-nowrap ${l.shares > 0 ? 'text-emerald-400 text-lg' : 'text-slate-500'}`}>
                  {l.shares}株
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-200 whitespace-nowrap">{l.shares > 0 ? yen(l.costYen) : '―'}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400 whitespace-nowrap">{l.priceYen === null ? '取得できず' : yen(l.priceYen)}</td>
                <td className="py-2 text-right font-mono text-slate-500 whitespace-nowrap">{yen(l.targetYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-400">
        使う額は{yen(plan.etfYen)}です。残り{yen(plan.leftoverYen)}は買わずに弾薬に残します。
        {plan.etfs.some(l => l.shares === 0 && l.priceYen !== null) && ' 0株の銘柄は、1株が目安額に比べて高いか、先に予算を使い切ったものです。その分も弾薬に残ります。'}
      </p>
    </div>
  );
}

export function SharePlan({ cashPool, phase, fg }: { cashPool: number | null; phase: Phase | null; fg: number | null }) {
  const [load, setLoad] = useState<Load>('loading');
  const [quotes, setQuotes] = useState<Quotes | null>(null);

  const fetchQuotes = async () => {
    setLoad('loading');
    try {
      const res = await fetch('/api/quotes');
      if (!res.ok) throw new Error(String(res.status));
      const q = (await res.json()) as Quotes;
      if (!q.usdjpy) throw new Error('ドル円が取れません');
      setQuotes(q);
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  };
  useEffect(() => { fetchQuotes(); }, []);

  let body: React.ReactNode;
  if (!phase || cashPool === null) {
    body = <p className="text-sm text-slate-400">弾薬とフェーズが揃うと、ここに買う株数が出ます。</p>;
  } else {
    const tranches = tranchesFor(phase, cashPool, fg);
    if (tranches.length === 0 && cashPool <= 0) {
      body = <p className="text-sm text-slate-400">弾薬が0円なので、買う株数はありません。弾薬を入れると、ここに株数が出ます。</p>;
    } else if (tranches.length === 0) {
      body = (
        <p className="text-sm text-slate-400">
          今は{phase}なので買いません。WATCH・HIGH・PERFECTになると、ここに銘柄ごとの株数が出ます。
        </p>
      );
    } else if (load === 'loading') {
      body = <p className="text-sm text-slate-400">株価とドル円を取得しています。</p>;
    } else if (load === 'error' || !quotes?.usdjpy) {
      body = (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">株価が取れなかったので、株数を出せません。金額の割合は上の表で見られます。</p>
          <button type="button" onClick={fetchQuotes} className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-600 text-slate-200">
            株価を取り直す
          </button>
        </div>
      );
    } else {
      const fx = quotes.usdjpy;
      const priceYen: Record<string, number | null> = {};
      for (const [t, p] of Object.entries(quotes.prices)) priceYen[t] = p === null ? null : p * fx;
      const when = quotes.asOf
        ? new Date(quotes.asOf).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '時刻不明';
      body = (
        <div className="space-y-6">
          {tranches.map(t => <OrderTable key={t.kind} t={t} priceYen={priceYen} phase={phase} />)}
          <p className="text-xs text-slate-500">
            株価は{when}の値、1ドル{fx.toFixed(2)}円で換算。為替と値動きのずれに備えて、1回分の{Math.round(SAFETY_MARGIN * 100)}%は使わずに残しています。注文の前に、楽天証券の画面で値段を確かめてください。
          </p>
        </div>
      );
    }
  }

  return (
    <div data-testid="share-plan">
      {body}
    </div>
  );
}
