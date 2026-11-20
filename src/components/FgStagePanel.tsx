"use client";

import { useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';
import { FG_STAGES, SLEEVES, SLEEVE_ORDER, fgStage } from '@/lib/fg-stages';
import type { Phase } from '@/lib/signals';

// 暴落の深さ（F&Gの段階）と、段階ごとに買う銘柄の割合。
// この画面の仕事は1つ：「今の段階なら、何をどの割合で買うか」を表で見比べられること。
// 段階を見比べる表なので、カードに崩さない（狭い画面は1列目を固定して横に送る）。
// 割合の正本は lib/fg-stages.ts。Slack通知も同じ値を読む。

type Status = 'loading' | 'error' | 'ready';

const pct = (x: number) => `${Math.round(x * 100)}%`;

const NEXT_STEP: Record<1 | 2 | 3, string> = {
  1: 'F&Gが20以下になると段階2に入ります。',
  2: 'F&Gが10以下になると段階3に入ります。',
  3: 'これより深い段階はありません。',
};

export function FgStagePanel({ fg, status, phase }: { fg: number | null; status: Status; phase: Phase | null }) {
  const current = fg === null ? null : fgStage(fg);
  const scroller = useRef<HTMLDivElement>(null);
  const currentCol = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const box = scroller.current;
    const col = currentCol.current;
    if (!box || !col || box.scrollWidth <= box.clientWidth) return;
    const first = box.querySelector('th');
    const firstW = first ? first.getBoundingClientRect().width : 0;
    box.scrollLeft = Math.max(0, col.offsetLeft - firstW);
  }, [current?.stage]);

  let headline: string;
  if (status === 'loading') {
    headline = 'F&Gを取得しています。表はこのまま見られます。';
  } else if (status === 'error' || fg === null) {
    headline = 'F&Gが取れませんでした。今の段階は出せませんが、表はこのまま使えます。';
  } else if (current) {
    headline = `今は段階${current.stage}「${current.name}」です（F&G ${fg}）。${NEXT_STEP[current.stage]}`;
  } else {
    headline = `今は暴落局面ではありません（F&G ${fg}）。F&Gが30以下になると段階1に入ります。それまでは積立だけ続けます。`;
  }

  const levText = phase === 'PERFECT'
    ? '今はPERFECTです。通知に出る額を4回に分け、3営業日ごとに指値で入れます。一括では買いません。'
    : `PERFECT（F&G・VIX・SKEWの3条件がすべて揃った時）だけ買います。今は${phase ?? '判定待ち'}なので買いません。`;

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-8 border-l-8 border-l-emerald-600">
      <h2 className="text-sm font-black text-emerald-400 tracking-[0.2em] flex items-center gap-3 mb-3">
        <Layers className="w-4 h-4" /> 暴落の段階と買う銘柄
      </h2>
      <p className="text-base text-slate-100 font-bold mb-1" data-testid="fg-stage-headline">{headline}</p>
      <p className="text-sm text-slate-400 mb-5">
        金額は弾薬とフェーズで決まり、Slackの通知に出ます。この表で決めるのは、その金額をどの銘柄にどの割合で分けるかです。
      </p>

      {/* 狭い画面では今の段階の列が右に隠れるので、開いた時にその列まで送っておく */}
      <div ref={scroller} className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full min-w-[600px] text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-left text-xs text-slate-400 font-black p-3 border-b border-slate-700 w-[200px] sm:w-[34%]">
                役割と銘柄
              </th>
              {FG_STAGES.map((s) => {
                const on = current?.stage === s.stage;
                return (
                  <th
                    key={s.stage}
                    ref={on ? currentCol : undefined}
                    className={`text-center p-3 border-b border-slate-700 ${on ? 'bg-emerald-900/60 text-emerald-200' : 'text-slate-300'}`}
                  >
                    <div className="text-xs font-black">段階{s.stage}「{s.name}」</div>
                    <div className="text-xs font-normal text-slate-400">{s.range}</div>
                    {on && <div className="mt-1 inline-block rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">今ここ</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SLEEVE_ORDER.map((k) => {
              const s = SLEEVES[k];
              return (
                <tr key={k}>
                  <td className="sticky left-0 z-10 bg-slate-900 p-3 border-b border-slate-800 align-top">
                    <div className="font-black text-slate-100">
                      {s.label} <span className="text-xs font-bold text-slate-400">（{s.role}）</span>
                    </div>
                    <div className="text-slate-200">米国ETF：{s.etf}</div>
                    <div className="text-slate-300">投信：{s.fund}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.basis}</div>
                  </td>
                  {FG_STAGES.map((st) => {
                    const on = current?.stage === st.stage;
                    const v = st.mix[k];
                    return (
                      <td
                        key={st.stage}
                        className={`text-center p-3 border-b border-slate-800 font-mono text-2xl font-black align-middle ${on ? 'bg-emerald-900/40 text-emerald-200' : v === 0 ? 'text-slate-600' : 'text-slate-200'}`}
                      >
                        {v === 0 ? <span className="text-sm font-bold">買わない</span> : pct(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td className="sticky left-0 z-10 bg-slate-900 p-3 align-top">
                <div className="font-black text-slate-400">3倍ブル</div>
                <div className="text-slate-400">米国ETF：SPXL・TQQQ</div>
                <div className="text-xs text-slate-500 mt-1">2000年・2008年の下げ相場で買うと1年で-85%前後</div>
              </td>
              <td colSpan={3} className="p-3 text-center text-slate-400 align-middle">
                {levText}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        割合の根拠は、VIXが28を超えた日に買って1年後の成績です（2008年以降19回・ドル建て・配当込み・円高の影響は入っていません）。段階の区切り（30・20・10）は、F&Gの過去データが取れず検証していません。
      </p>
    </section>
  );
}
