import type { Phase } from './signals';

// Slack通知「今どう動くか」を、フェーズと弾薬(cashPool)から決定論的に組み立てる。
//
// 設計方針（2026-09-11 実態調査にもとづき全面改訂）:
//  - 毎月の積立は自動で走るので、通知では「継続中・操作不要」と示すだけ。
//    金額判断の対象にしない。
//  - 判断が要るのは裁量の弾薬(cashPool)をいつ・何に・いくら出すか。ここが通知の本体。
//  - 金額は cashPool × フェーズ別の投入率 で機械的に決まる。感覚でサイズを決めない
//    （IEG＝取引統制と同じ原則）。
//  - レバレッジ(3倍ブル)は全フェーズで一括禁止。必ず分割。
//
// 旧版は src/data/portfolio.ts の月50万円前提の配分を使っていたが、実際の積立は
// 月10万円で、profile.holdings の列挙も実態と乖離していたため参照をやめた。

export type Capital = {
  cashPool: number; // profile.cashPool（投資に回してよい待機資金＝弾薬）
  maxSingleAsset: number; // profile.maxSingleAsset（1銘柄あたり上限）
};

export const DEFAULT_CAPITAL: Capital = { cashPool: 0, maxSingleAsset: 200000 };

// 毎月の自動積立（2026-09-11 時点の実設定）。合計 月100,000円。
// 通知では合計額と「継続中」だけ出す。ここを増減するのは通知ではなく本人の設定変更。
export const MONTHLY_TSUMITATE: { name: string; yen: number; account: string }[] = [
  { name: 'eMAXIS Slim オルカン', yen: 50000, account: 'NISAつみたて' },
  { name: '楽天・VYM', yen: 20000, account: 'NISAつみたて' },
  { name: 'ニッセイTOPIX', yen: 8000, account: '特定' },
  { name: '大和住銀DC国内株式', yen: 7000, account: '特定' },
  { name: 'Tracers S&P1000(米国中小型)', yen: 8000, account: '特定' },
  { name: 'eMAXIS Slim 新興国株式', yen: 7000, account: '特定' },
];

export const MONTHLY_TOTAL = MONTHLY_TSUMITATE.reduce((a, f) => a + f.yen, 0);

const PHASE_LABEL: Record<Phase, string> = {
  HEAT: '🔴 HEAT（過熱・利確/現金化）',
  PERFECT: '🟢 PERFECT（総悲観・最大の買い場）',
  HIGH: '🟢 HIGH（押し目買い）',
  WATCH: '🟡 WATCH（下落の入口・レバは我慢）',
  NEUTRAL: '⚪ NEUTRAL（通常・積立のみ）',
};

// 弾薬(cashPool)をフェーズごとにどれだけ・どこへ出すか（cashPool に対する比率）。
// PERFECT は全額放出、HIGH は3割だけ先行、それ以外は温存。
// レバレッジは PERFECT のみ、かつ必ず分割で入る。
const DEPLOY: Record<Phase, { core: number; leverage: number }> = {
  HEAT: { core: 0, leverage: 0 },
  PERFECT: { core: 0.7, leverage: 0.3 },
  HIGH: { core: 0.3, leverage: 0 },
  WATCH: { core: 0, leverage: 0 },
  NEUTRAL: { core: 0, leverage: 0 },
};

const CORE_TICKERS = '`VT` `VTI` ／ 投信: オルカン / eMAXIS Slim S&P500';
const LEV_TICKERS = '`SPXL` `TQQQ`';

const KNIFE =
  '⚠️ 3倍ブルは一括禁止。想定DD 原資産-30%→レバ実質-70%級。SKEW>150は「まだ掴むな」。' +
  '弾薬はPoolから（生活/運転資金は不可）。IEG諮問＋小池承認の上で発注。';

export function yen(n: number): string {
  if (n === 0) return '0円';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万円`;
  return `${n.toLocaleString('ja-JP')}円`;
}

export type DeployPlan = {
  coreYen: number;
  leverageYen: number;
  totalYen: number;
  coreAdvice: string;
  leverageAdvice: string;
  overSingleCap: boolean;
};

export function buildDeployPlan(phase: Phase, capital: Capital = DEFAULT_CAPITAL): DeployPlan {
  const r = DEPLOY[phase];
  const coreYen = Math.round(capital.cashPool * r.core);
  const leverageYen = Math.round(capital.cashPool * r.leverage);

  let coreAdvice: string;
  if (coreYen <= 0) {
    coreAdvice = phase === 'HEAT' ? '買わない。むしろ利確して弾薬に戻す局面' : '買わない（弾薬は温存）';
  } else if (phase === 'PERFECT') {
    coreAdvice = '🎯 ショットOK。成行一括で拾う（千載一遇・待たない）';
  } else {
    coreAdvice = '3回に分割・5営業日ごと（約3週間）・下落日に指値';
  }

  let leverageAdvice: string;
  if (leverageYen <= 0) {
    leverageAdvice =
      phase === 'HEAT'
        ? '保有していれば全決済して現金化（減価が致命傷）'
        : '買わない（レンジ減価でジリ貧）';
  } else {
    leverageAdvice = '⚡ 4回に分割・3営業日ごと（約2週間）・各回とも指値。一括厳禁';
  }

  // Core は VT/VTI/オルカン/S&P500 の4本に散らす前提で1銘柄あたりを見る
  const perName = coreYen / 4;
  return {
    coreYen,
    leverageYen,
    totalYen: coreYen + leverageYen,
    coreAdvice,
    leverageAdvice,
    overSingleCap: perName > capital.maxSingleAsset,
  };
}

export function formatBuyAction(
  phase: Phase,
  capital: Capital = DEFAULT_CAPITAL,
  indicators?: { fg: number; vix: number; skew: number; signalsActive: number },
): string {
  const p = buildDeployPlan(phase, capital);
  const lines: string[] = [`📌 *今どう動くか*  ${PHASE_LABEL[phase]}`];

  if (indicators) {
    lines.push(
      `📊 F&G ${indicators.fg} / VIX ${indicators.vix} / SKEW ${indicators.skew} ・ 買いシグナル ${indicators.signalsActive}/3`,
    );
  }

  lines.push(`🔁 積立（自動・月${yen(MONTHLY_TOTAL)}）: 継続中。操作不要`);
  lines.push(`💰 弾薬 ${yen(capital.cashPool)} → 今回投入 ${yen(p.totalYen)}`);
  lines.push('');

  if (p.totalYen <= 0) {
    lines.push(`• Core: ${p.coreAdvice}`);
    lines.push(`• Leverage 3倍ブル: ${p.leverageAdvice}`);
    return lines.join('\n');
  }

  if (p.coreYen > 0) {
    lines.push(`*Core 全世界/全米* — ${yen(p.coreYen)}`);
    lines.push(`   ${CORE_TICKERS}`);
    lines.push(`   ↳ ${p.coreAdvice}`);
    if (p.overSingleCap) {
      lines.push(`   ⚠️ 1銘柄上限${yen(capital.maxSingleAsset)}超。銘柄を分散するか注文を分けること`);
    }
  }
  if (p.leverageYen > 0) {
    lines.push(`*Leverage 3倍ブル* — ${yen(p.leverageYen)}`);
    lines.push(`   ${LEV_TICKERS}`);
    lines.push(`   ↳ ${p.leverageAdvice}`);
  }

  lines.push('');
  lines.push(KNIFE);
  return lines.join('\n');
}
