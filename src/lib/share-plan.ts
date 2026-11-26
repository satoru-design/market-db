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
  // 2026-11-26 小池「GLDも守りの候補に入れて」→ 4等分。重ならない8回の最悪が -14% で4本の中で一番浅く、
  //  2007-11・2008-01 の下げの入口でも -12%・-20%（XLP -25%・-28%）だった。株と違う値動きをする唯一の1本。
  def: [
    { ticker: 'VIG', weight: 1 / 4 },
    { ticker: 'XLV', weight: 1 / 4 },
    { ticker: 'XLP', weight: 1 / 4 },
    { ticker: 'GLD', weight: 1 / 4 },
  ],
  // 2026-11-26 小池「XLK・QQQ・SMHも残す」→ 戻りを3等分。重ならない8回で測ると3本はほぼ横並びで、
  //  どれか1本に絞る根拠が無かった（根拠の数字は fg-stages.ts の SLEEVES.rebound）。
  // 同日 小池「COPXとSPHBも候補に入れて」→ 5等分。COPX（銅鉱山）と SPHB（S&P500の高β100社）は
  //  ハイテク以外から戻りを取る候補。ただし上場が新しく、重ならない回は6回・5回しか測れていない。
  rebound: [
    { ticker: 'QQQ', weight: 1 / 5 },
    { ticker: 'XLK', weight: 1 / 5 },
    { ticker: 'SMH', weight: 1 / 5 },
    { ticker: 'COPX', weight: 1 / 5 },
    { ticker: 'SPHB', weight: 1 / 5 },
  ],
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

// ---- Slack の通知に載せる文面（2026-11-21 追加・小池「通知にも出す」）----
// 画面の「この弾薬で買う株数」と同じ計算（tranchesFor → planOrder）を文字にする。
// 株価が取れない時も、何も書かずに黙らない（出せない理由を1行で書く）。

const fullYen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`;

const REPEAT: Record<Tranche['kind'], (t: Tranche, phase: Phase) => string> = {
  core: (t, phase) => (phase === 'HIGH' ? `同じ注文を${t.times}回` : '一括'),
  leverage: t => `同じ注文を${t.times}回`,
};

export function formatSharesForSlack(
  phase: Phase,
  cashPool: number,
  fg: number | null,
  priceYen: Record<string, number | null> | null,
  quoteNote: string,
): string | null {
  const tranches = tranchesFor(phase, cashPool, fg);
  if (tranches.length === 0) return null;
  if (!priceYen) return '*1回に買う株数*\n株価が取れなかったので、株数は出せません。金額は上のとおりです。';

  const parts: string[] = [];
  for (const t of tranches) {
    const plan = planOrder(t.budgetYen, t.buckets, priceYen);
    const title = t.kind === 'leverage' ? '3倍ブル' : '主力・守り・戻り';
    const lines = [`*1回に買う株数：${title}*（1回${fullYen(t.budgetYen)}・${REPEAT[t.kind](t, phase)}）`];
    for (const l of plan.etfs.filter(l => l.shares > 0)) {
      lines.push(`\`${l.ticker}\` ${l.shares}株  ${fullYen(l.costYen)}`);
    }
    for (const f of plan.funds) lines.push(`投信 ${f.name}  ${fullYen(f.yen)}`);
    const zero = plan.etfs.filter(l => l.shares === 0).map(l => l.ticker);
    if (zero.length) {
      const why = t.kind === 'leverage'
        ? '1株が目安額より高い分。投信には回さず弾薬に残す'
        : '1株が目安額より高いか、先に予算を使い切った分。投信で埋めている';
      lines.push(`0株：${zero.join('・')}（${why}）`);
    }
    lines.push(`使う額 ${fullYen(plan.etfYen + plan.fundYen)}・残り${fullYen(plan.leftoverYen)}は弾薬に残す`);
    parts.push(lines.join('\n'));
  }
  parts.push(`${quoteNote}。1回分の${Math.round(SAFETY_MARGIN * 100)}%は値動きと為替の余白。注文前に楽天証券で値段を確かめる`);
  return parts.join('\n\n');
}

/** 通知の脚注に使う「いつの株価か」。 */
export function quoteNoteOf(asOf: string | null, usdjpy: number | null): string {
  const when = asOf
    ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(asOf))
    : '時刻不明';
  return `株価は${when}の値・1ドル${usdjpy ? usdjpy.toFixed(2) : '--'}円で換算`;
}
