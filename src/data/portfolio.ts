// フェーズ別の配分データ。
//
// 2026-11-21 作り直し（小池「古い配分データも今の表に合わせて」）:
//  以前はカテゴリ7つ（成長・インカム・防御・海外資源・金・3倍ブル・債券）に
//  「月◯万円」の予算を手で書いていた。今のルール（積立は自動・裁量は弾薬×フェーズ・
//  中身はF&Gの段階の割合）と食い違っていたので、手書きをやめて正本から組み立てる形にした。
//   金額の割合 → lib/buy-action.ts の DEPLOY
//   銘柄と段階の割合 → lib/fg-stages.ts
//   毎月の積立 → lib/buy-action.ts の MONTHLY_TSUMITATE
//  ここに銘柄名や割合を手で書き足さないこと。書くと、また画面と通知が食い違う。
//
//  外したもの（今の表に無い）: FANG+・SOX・JEPQ・BDC・豪州高配当・ITA・インド株の新規買い、
//  金・銀の買い増し、債券の積み増し。保有は続けてよい。毎月の積立に入っているものは「積立」に残る。

import { DEPLOY, MONTHLY_TSUMITATE, MONTHLY_TOTAL, buildDeployPlan, yen } from '@/lib/buy-action';
import { FG_STAGES, SLEEVES, SLEEVE_ORDER, type Sleeve } from '@/lib/fg-stages';

export type Phase = "HEAT" | "PERFECT" | "HIGH" | "WATCH" | "NEUTRAL";
export type StrategyEntry = { budget: string; action: string };
export type PortfolioCategory = {
  id: string;
  category: string;
  items: string[];
  strategy: Record<Phase, StrategyEntry>;
};

const PHASES: Phase[] = ['HEAT', 'PERFECT', 'HIGH', 'WATCH', 'NEUTRAL'];
const pct = (x: number) => `${Math.round(x * 100)}%`;
// 文言だけ欲しいので、弾薬は仮の額で計画を組む（金額は使わない）
const advice = (ph: Phase) => buildDeployPlan(ph, { cashPool: 1_000_000, maxSingleAsset: 200_000 });

function sleeveCategory(k: Sleeve): PortfolioCategory {
  const s = SLEEVES[k];
  const byStage = FG_STAGES.map((st) => `段階${st.stage} ${pct(st.mix[k])}`).join('・');
  const strategy = {} as Record<Phase, StrategyEntry>;
  for (const ph of PHASES) {
    const core = DEPLOY[ph].core;
    strategy[ph] = core > 0
      ? { budget: `弾薬の${pct(core)}のうち ${byStage}`, action: advice(ph).coreAdvice }
      : { budget: '0円', action: advice(ph).coreAdvice };
  }
  return {
    id: k,
    category: `${s.label}（${s.role}）`,
    items: [`米国ETF：${s.etf}`],
    strategy,
  };
}

function leverageCategory(): PortfolioCategory {
  const strategy = {} as Record<Phase, StrategyEntry>;
  for (const ph of PHASES) {
    const lev = DEPLOY[ph].leverage;
    strategy[ph] = { budget: lev > 0 ? `弾薬の${pct(lev)}` : '0円', action: advice(ph).leverageAdvice };
  }
  return { id: 'leverage', category: '3倍ブル（PERFECTの時だけ）', items: ['SPXL', 'TQQQ'], strategy };
}

function tsumitateCategory(): PortfolioCategory {
  const strategy = {} as Record<Phase, StrategyEntry>;
  for (const ph of PHASES) {
    strategy[ph] = { budget: `月${yen(MONTHLY_TOTAL)}`, action: '自動で続く。操作は要らない' };
  }
  return {
    id: 'tsumitate',
    category: '毎月の積立（自動）',
    items: MONTHLY_TSUMITATE.map((f) => `${f.name}（${f.broker}・${yen(f.yen)}）`),
    strategy,
  };
}

function poolCategory(): PortfolioCategory {
  const strategy = {} as Record<Phase, StrategyEntry>;
  for (const ph of PHASES) {
    const out = DEPLOY[ph].core + DEPLOY[ph].leverage;
    strategy[ph] = {
      budget: out > 0 ? `弾薬の${pct(out)}を出す` : '出さない',
      action: ph === 'HEAT' ? '利確した分を弾薬に戻す' : out > 0 ? '主力・守り・戻り（PERFECTなら3倍ブルも）へ' : '温存する',
    };
  }
  return { id: 'pool', category: '弾薬（待機資金）', items: ['投資に回してよい待機資金（cashPool）'], strategy };
}

export const portfolioData: PortfolioCategory[] = [
  ...SLEEVE_ORDER.map(sleeveCategory),
  leverageCategory(),
  tsumitateCategory(),
  poolCategory(),
];
