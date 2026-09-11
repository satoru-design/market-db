import { portfolioData } from '@/data/portfolio';
import type { Phase } from './signals';

// 「今何を買うか」のSlack通知テキストを、フェーズ＋資金状況から決定論的に組み立てる。
//
// 設計方針:
//  - 配分の正本は src/data/portfolio.ts。金額をこのファイルで発明しない。
//  - 金額は (フェーズ別予算 × 月予算スケール) ＋ (Pool投入率 × cashPool) で機械的に決まる。
//    感覚でサイズを決めないのは IEG（取引統制）と同じ原則。
//  - エントリー方式（ショット / 分割 / 積立）はフェーズ×カテゴリの表で決まる。
//    レバレッジは全フェーズで一括禁止＝必ず分割。

export type Capital = {
  monthlyBudget: number; // profile.monthlyBudget（月次予算）
  cashPool: number; // profile.cashPool（買付余力＝弾薬）
  maxSingleAsset: number; // profile.maxSingleAsset（1銘柄あたり上限）
};

export const DEFAULT_CAPITAL: Capital = {
  monthlyBudget: 500000,
  cashPool: 0,
  maxSingleAsset: 200000,
};

export type EntryMode = 'MONTHLY' | 'SHOT' | 'SPLIT' | 'NONE' | 'SELL';

export type CategoryPlan = {
  id: string;
  label: string;
  monthlyYen: number; // 月次予算からの配分
  poolYen: number; // 弾薬(Pool)からの追加投入
  totalYen: number;
  tickers: string[];
  funds: string[];
  mode: EntryMode;
  advice: string;
  overSingleCap: boolean;
};

const CATEGORY_SHORT: Record<string, string> = {
  core: 'Core 全世界/全米',
  growth: 'Growth NASDAQ/FANG+',
  value: 'Income 高配当/BDC',
  defensive: 'Defensive ヘルスケア/防衛',
  emerging: 'Global/資源 インド/豪',
  hedge: 'Hedge 金・銀',
  leverage: 'Leverage 3倍ブル',
  pool: 'Pool 債券/待機資金',
};

const PHASE_LABEL: Record<Phase, string> = {
  HEAT: '🔴 HEAT（過熱・利確/現金化）',
  PERFECT: '🟢 PERFECT（総悲観・最大の買い場）',
  HIGH: '🟢 HIGH（押し目買い）',
  WATCH: '🟡 WATCH（下落の入口・レバは我慢）',
  NEUTRAL: '⚪ NEUTRAL（通常・積立ベース）',
};

// 買付対象の具体銘柄。ティッカーは米国ETF、fundsは投信の通称。
// portfolio.ts の items を通知向けに絞ったもの。
const INSTRUMENTS: Record<string, { tickers: string[]; funds: string[] }> = {
  core: { tickers: ['VT', 'VTI'], funds: ['オルカン', '楽天プラスS&P500', 'eMAXIS Slim S&P500'] },
  growth: { tickers: ['QQQ'], funds: ['ニッセイNASDAQ100', 'FANG+', 'メガ10', 'SOX'] },
  value: { tickers: ['VIG', 'VYM', 'SCHD', 'JEPQ'], funds: ['楽天VYM', '楽天SCHD', '楽天JEPQ', '米国BDC'] },
  defensive: { tickers: ['VHT', 'IXJ', 'ITA'], funds: [] },
  emerging: { tickers: ['EFA', 'BHP', 'RIO'], funds: ['eMAXISインド株式', 'iTrustインド株式'] },
  hedge: { tickers: ['IAU', 'GLDM', 'SLV'], funds: ['純金・銀・プラチナ積立'] },
  leverage: { tickers: ['SPXL', 'TQQQ'], funds: [] },
  pool: { tickers: [], funds: ['eMAXIS Slim国内債券', 'SBI全世界債券', '米ドル外貨預金'] },
};

// 弾薬(Pool)をどれだけ投入するか。portfolio.ts の pool 戦略に対応。
//  PERFECT = 「全額放出」 / HIGH = 「徐々に移行」 / それ以外 = 温存
// ※ HIGH の 0.3 は明示的な運用パラメータ（portfolio.ts に数値指定がないため）。
const POOL_DEPLOY_RATE: Record<Phase, number> = {
  HEAT: 0,
  PERFECT: 1.0,
  HIGH: 0.3,
  WATCH: 0,
  NEUTRAL: 0,
};

// 放出した弾薬の投入先。portfolio.ts の記述に従う。
//  PERFECT: 「Pool資金(全力) → VT / VTI へ成行一括」 → core
//  HIGH:    「プール資金を株式の積極投資枠へ移行」   → growth
const POOL_TARGET: Partial<Record<Phase, string>> = {
  PERFECT: 'core',
  HIGH: 'growth',
};

// portfolio.ts の budget 文字列（例 "20万円/月", "0円/月 (配当再投資)"）を円に変換する
export function parseBudgetYen(budget: string): number {
  const man = budget.match(/([\d.]+)\s*万円/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  const yen = budget.match(/([\d,]+)\s*円/);
  if (yen) return parseInt(yen[1].replace(/,/g, ''), 10);
  return 0;
}

function entryPlan(phase: Phase, categoryId: string, amount: number): { mode: EntryMode; advice: string } {
  if (categoryId === 'pool') {
    if (amount <= 0) return { mode: 'NONE', advice: '積み増しなし（弾薬は株式へ回す局面）' };
    return { mode: 'MONTHLY', advice: '毎月一定額を待機資金へ。暴落時の弾薬を貯める' };
  }

  if (amount <= 0) {
    if (phase === 'HEAT' && (categoryId === 'growth' || categoryId === 'leverage')) {
      return { mode: 'SELL', advice: '新規買付は停止。利益確定・決済を検討する局面' };
    }
    return { mode: 'NONE', advice: '買わない' };
  }

  // レバレッジは全フェーズで一括禁止。必ず分割で入る。
  if (categoryId === 'leverage') {
    if (phase === 'PERFECT') {
      return { mode: 'SPLIT', advice: '⚡ 4回に分割・3営業日ごと（約2週間）・各回とも指値。一括厳禁' };
    }
    if (phase === 'HIGH') {
      return { mode: 'SPLIT', advice: '⚡ 3回に分割・5営業日ごと（約3週間）・底打ち確認後に指値。一括厳禁' };
    }
    return { mode: 'NONE', advice: '買わない（レンジ減価でジリ貧）' };
  }

  switch (phase) {
    case 'PERFECT':
      return { mode: 'SHOT', advice: '🎯 ショットOK。成行一括で拾う（千載一遇・待たない）' };
    case 'HIGH':
      return { mode: 'SPLIT', advice: '3回に分割・5営業日ごと（約3週間）・下落日に指値で拾う' };
    case 'WATCH':
      return { mode: 'MONTHLY', advice: '毎月の自動積立で継続。スポット買いは控える' };
    case 'NEUTRAL':
      return { mode: 'MONTHLY', advice: '毎月の自動積立で継続（日々刻む必要なし）' };
    case 'HEAT':
      return { mode: 'MONTHLY', advice: '自動積立のみ最低限で継続。ETFスポット買いは停止' };
  }
}

export function buildPlan(phase: Phase, capital: Capital = DEFAULT_CAPITAL): CategoryPlan[] {
  const rawByCat = portfolioData.map((c) => ({ c, raw: parseBudgetYen(c.strategy[phase].budget) }));
  const rawSum = rawByCat.reduce((a, b) => a + b.raw, 0);
  // portfolio.ts は月50万円前提。profile.monthlyBudget が違えば比例配分する。
  const scale = rawSum > 0 ? capital.monthlyBudget / rawSum : 0;

  const poolDeploy = Math.round(capital.cashPool * POOL_DEPLOY_RATE[phase]);
  const poolTarget = POOL_TARGET[phase];

  return rawByCat.map(({ c, raw }) => {
    const monthlyYen = Math.round(raw * scale);
    const poolYen = poolTarget === c.id ? poolDeploy : 0;
    const totalYen = monthlyYen + poolYen;
    const inst = INSTRUMENTS[c.id] ?? { tickers: [], funds: [] };
    const { mode, advice } = entryPlan(phase, c.id, totalYen);
    const spreadCount = Math.max(inst.tickers.length + inst.funds.length, 1);
    return {
      id: c.id,
      label: CATEGORY_SHORT[c.id] ?? c.category,
      monthlyYen,
      poolYen,
      totalYen,
      tickers: inst.tickers,
      funds: inst.funds,
      mode,
      advice,
      overSingleCap: totalYen / spreadCount > capital.maxSingleAsset,
    };
  });
}

function yen(n: number): string {
  if (n === 0) return '0円';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万円`;
  return `${n.toLocaleString('ja-JP')}円`;
}

const KNIFE_DISCIPLINE =
  '⚠️ 3倍ブルは一括禁止。想定DD 原資産-30%→レバ実質-70%級。SKEW>150は「まだ掴むな」。' +
  '弾薬はPoolから（生活/運転資金は不可）。IEG諮問＋承認の上で発注。';

export function formatBuyAction(
  phase: Phase,
  capital: Capital = DEFAULT_CAPITAL,
  indicators?: { fg: number; vix: number; skew: number; signalsActive: number },
): string {
  const plans = buildPlan(phase, capital);
  const poolDeployed = plans.reduce((a, p) => a + p.poolYen, 0);
  const total = plans.reduce((a, p) => a + p.totalYen, 0);

  const head = [`📌 *今何を買うか*  ${PHASE_LABEL[phase]}`];
  if (indicators) {
    head.push(
      `📊 F&G ${indicators.fg} / VIX ${indicators.vix} / SKEW ${indicators.skew} ・ 買いシグナル ${indicators.signalsActive}/3`,
    );
  }
  head.push(
    `💰 月予算 ${yen(capital.monthlyBudget)} ・ 弾薬(Pool) ${yen(capital.cashPool)} → 今回投入 ${yen(poolDeployed)}`,
  );

  const active: string[] = [];
  const zero: string[] = [];

  for (const p of plans) {
    if (p.totalYen <= 0) {
      zero.push(`• ${p.label}: 0円（${p.advice}）`);
      continue;
    }
    const names = [
      ...p.tickers.map((t) => `\`${t}\``),
      ...(p.funds.length ? [`投信: ${p.funds.join(' / ')}`] : []),
    ].join(' ');
    const poolNote = p.poolYen > 0 ? `（月予算 ${yen(p.monthlyYen)} ＋ 弾薬 ${yen(p.poolYen)}）` : '';
    const cap = p.overSingleCap ? `\n   ⚠️ 1銘柄上限${yen(capital.maxSingleAsset)}超。銘柄を分散するか注文を分けること` : '';
    active.push(`*${p.label}* — ${yen(p.totalYen)}${poolNote}\n   ${names}\n   ↳ ${p.advice}${cap}`);
  }

  const parts = [head.join('\n'), '', ...active];
  if (zero.length) parts.push('', ...zero);
  parts.push('', `合計 ${yen(total)}`);
  if (phase === 'PERFECT' || phase === 'HIGH') parts.push(KNIFE_DISCIPLINE);

  return parts.join('\n');
}
