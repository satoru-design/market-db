import { DEPLOY } from './buy-action';
import { fgStage, splitByStage, type Sleeve } from './fg-stages';
import type { Phase } from './signals';

// 弾薬の額から「どの銘柄を何株買うか」を出す。2026-11-21 追加（小池）。
//  金額 = 弾薬 × フェーズの割合（DEPLOY）。HIGH は3回に分けるので1回分を出す。
//  中身 = F&G の段階の割合（fg-stages.ts）。
//  米国ETFは1株単位でしか買えないので、目安額に一番近くなる株数を選ぶ。
//  ETFで割り切れなかった残りは、同じ役割の投信（100円単位で買える）に回す。
//  為替と値動きのずれに備えて、1回分の2%は使わずに残す。

export type Bucket = Sleeve | 'leverage';

export const ETF_PLAN: Record<Bucket, { ticker: string; weight: number }[]> = {
  main: [{ ticker: 'VT', weight: 1 }],
  def: [
    { ticker: 'VIG', weight: 1 / 3 },
    { ticker: 'XLV', weight: 1 / 3 },
    { ticker: 'XLP', weight: 1 / 3 },
  ],
  rebound: [{ ticker: 'QQQ', weight: 1 }],
  leverage: [
    { ticker: 'SPXL', weight: 0.5 },
    { ticker: 'TQQQ', weight: 0.5 },
  ],
};

// 投信で残りを埋める先。3倍ブルには投信を当てない（同じ値動きの投信が無い）。
export const FUND_FOR: Record<Sleeve, string> = {
  main: 'オルカン',
  def: '楽天・VYM',
  rebound: 'NASDAQ100の投信',
};

export const PLAN_TICKERS = Object.values(ETF_PLAN).flat().map(e => e.ticker);
export const SAFETY_MARGIN = 0.02;

export type Tranche = {
  kind: 'core' | 'leverage';
  times: number; // 同じ額を何回に分けて買うか
  budgetYen: number; // 1回分
  buckets: Partial<Record<Bucket, number>>;
};

export function tranchesFor(phase: Phase, cashPool: number, fg: number | null): Tranche[] {
  const r = DEPLOY[phase];
  const coreYen = Math.round(cashPool * r.core);
  const levYen = Math.round(cashPool * r.leverage);
  const out: Tranche[] = [];
  if (coreYen > 0) {
    const times = phase === 'HIGH' ? 3 : 1;
    const per = Math.floor(coreYen / times);
    const split = splitByStage(per, fg === null ? null : fgStage(fg));
    out.push({ kind: 'core', times, budgetYen: per, buckets: split });
  }
  if (levYen > 0) {
    const per = Math.floor(levYen / 4);
    out.push({ kind: 'leverage', times: 4, budgetYen: per, buckets: { leverage: per } });
  }
  return out;
}

export type EtfLine = {
  bucket: Bucket;
  ticker: string;
  targetYen: number;
  priceYen: number | null; // 取れなかった時は null（株数0で、目安額は投信に回る）
  shares: number;
  costYen: number;
};
export type FundLine = { bucket: Sleeve; name: string; yen: number };
export type OrderPlan = {
  budgetYen: number;
  etfs: EtfLine[];
  funds: FundLine[];
  etfYen: number;
  fundYen: number;
  leftoverYen: number;
};

export function planOrder(
  budgetYen: number,
  buckets: Partial<Record<Bucket, number>>,
  priceYen: Record<string, number | null | undefined>,
): OrderPlan {
  const cap = Math.floor(budgetYen * (1 - SAFETY_MARGIN));
  const etfs: EtfLine[] = [];
  for (const [bucket, yen] of Object.entries(buckets) as [Bucket, number][]) {
    if (!yen || yen <= 0) continue;
    for (const e of ETF_PLAN[bucket]) {
      const p = priceYen[e.ticker];
      etfs.push({
        bucket,
        ticker: e.ticker,
        targetYen: Math.round(yen * e.weight),
        priceYen: typeof p === 'number' && p > 0 ? p : null,
        shares: 0,
        costYen: 0,
      });
    }
  }

  // 1株足した時に「目安額とのずれ」が一番減る銘柄から1株ずつ足す。
  // ずれが増える（足りない額が株価の半分以下）銘柄は足さない。
  // 2026-11-21 直し: 以前は「一番足りない銘柄」から足していて、300万円の時に
  //  守りで一番安い XLP が0株・高い VIG が1株になっていた。
  const gain = (l: EtfLine) => {
    const short = l.targetYen - l.costYen;
    return short - Math.abs(short - (l.priceYen ?? 0));
  };
  let remaining = cap;
  for (;;) {
    let best: EtfLine | null = null;
    for (const l of etfs) {
      if (l.priceYen === null || l.priceYen > remaining) continue;
      if (gain(l) <= 0) continue;
      if (!best || gain(l) > gain(best)) best = l;
    }
    if (!best || best.priceYen === null) break;
    best.shares += 1;
    best.costYen += best.priceYen;
    remaining -= best.priceYen;
  }
  for (const l of etfs) l.costYen = Math.round(l.costYen);
  const etfYen = etfs.reduce((s, l) => s + l.costYen, 0);

  // ETFで埋まらなかった分を、役割ごとの投信へ（100円単位・余白の2%は残す）。
  const pool = Math.max(0, cap - etfYen);
  const shortBy: [Sleeve, number][] = [];
  for (const [bucket, yen] of Object.entries(buckets) as [Bucket, number][]) {
    if (bucket === 'leverage' || !yen) continue;
    const spent = etfs.filter(l => l.bucket === bucket).reduce((s, l) => s + l.costYen, 0);
    if (yen - spent > 0) shortBy.push([bucket, yen - spent]);
  }
  const totalShort = shortBy.reduce((s, [, v]) => s + v, 0);
  const scale = totalShort > pool ? pool / totalShort : 1;
  const funds: FundLine[] = shortBy
    .map(([bucket, v]) => ({ bucket, name: FUND_FOR[bucket], yen: Math.floor((v * scale) / 100) * 100 }))
    .filter(f => f.yen >= 100);
  const fundYen = funds.reduce((s, f) => s + f.yen, 0);

  return { budgetYen, etfs, funds, etfYen, fundYen, leftoverYen: budgetYen - etfYen - fundYen };
}
