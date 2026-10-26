import type { Phase } from './signals';

// Slack通知「今どう動くか」を、フェーズと弾薬(cashPool)から決定論的に組み立てる。
//
// 設計方針:
//  - 毎月の積立は自動で走るので、通知では「継続中・操作不要」と示すだけ。
//    金額判断の対象にしない。
//  - 判断が要るのは裁量の弾薬(cashPool)をいつ・何に・いくら出すか。ここが通知の本体。
//  - 金額は cashPool × フェーズ別の投入率 で機械的に決まる。感覚でサイズを決めない
//    （IEG＝取引統制と同じ原則）。
//  - レバレッジ(3倍ブル)は PERFECT のみ。かつ必ず分割。
//
// 2026-10-18 追加「打診枠」:
//  WATCH は長く続く。その間ずっと投入ゼロだと我慢が切れて一番まずい形
//  （3倍ブルを衝動で一括）に出る。逃げ道を設計に入れる方が守れる。
//  よって WATCH でも Core に限って弾薬の10%まで入れてよいことにした。
//  レバレッジは WATCH では引き続きゼロ。
//
//  金額は「増分」ではなく「目標残高」として出す。WATCH が数か月続いても
//  通知は毎回同じ目標額を示すだけで、既に入れていれば追加は発生しない。
//  増分で出すと毎朝買い増す指示になってしまうため。

export type Capital = {
  cashPool: number; // profile.cashPool（投資に回してよい待機資金＝弾薬）
  maxSingleAsset: number; // profile.maxSingleAsset（1銘柄あたり上限）
};

export const DEFAULT_CAPITAL: Capital = { cashPool: 0, maxSingleAsset: 200000 };

// 毎月の自動積立（楽天証券。2026-10-26 に3画面を実機で確認した実設定）。
// 合計 月148,304円。
//
// 2026-10-26 までの誤り:
//  投信のぶん（10万円）だけを持っていて、米株積立と貴金属積立を数えていなかった。
//  通知は「積立 月10.0万円」と言い続けていたが、実際には月148,304円が出ていた。
//  同日の棚卸しで、止めた設定（投信4本・米株3本・貴金属2本／計148,745円）を外し、
//  残った設定をここへ写した。画面に無い金額は書かない。
//
// 米株と純金は1本ごとの金額を画面から取り切っていないので束で持つ。
// 推定で1本ずつに割り振ると、測った数字と作った数字の区別がつかなくなる。
//
// 注意: NISAつみたて枠の2026年ぶんは使い切っている。11月・12月の
//  オルカン/楽天VYM は枠不足でエラーになり得る（米株積立で同じ事故が起きた）。
//  その場合の実額は月78,304円まで落ちる。走った結果を見て直す。
export const MONTHLY_TSUMITATE: { name: string; yen: number; account: string }[] = [
  { name: 'eMAXIS Slim オルカン', yen: 50000, account: 'NISAつみたて' },
  { name: '楽天・VYM', yen: 20000, account: 'NISAつみたて' },
  { name: 'ニッセイTOPIX', yen: 8000, account: '特定' },
  { name: '大和住銀DC国内株式', yen: 7000, account: '特定' },
  { name: 'Tracers S&P1000(米国中小型)', yen: 8000, account: '特定' },
  { name: 'eMAXIS Slim 新興国株式', yen: 7000, account: '特定' },
  { name: '米株積立 BHP / EFA / RIO（3本・束）', yen: 43304, account: '特定' },
  { name: '純金積立', yen: 5000, account: '特定' },
];

export const MONTHLY_TOTAL = MONTHLY_TSUMITATE.reduce((a, f) => a + f.yen, 0);

const PHASE_LABEL: Record<Phase, string> = {
  HEAT: '🔴 HEAT（過熱・利確/現金化）',
  PERFECT: '🟢 PERFECT（総悲観・最大の買い場）',
  HIGH: '🟢 HIGH（押し目買い）',
  WATCH: '🟡 WATCH（下落の入口・打診枠のみ）',
  NEUTRAL: '⚪ NEUTRAL（通常・積立のみ）',
};

// 弾薬(cashPool)をフェーズごとにどれだけ・どこへ出すか（cashPool に対する比率）。
//  PERFECT = 全額放出 / HIGH = 3割 / WATCH = 1割の打診枠 / HEAT・NEUTRAL = 温存
//  レバレッジは PERFECT のみ。
const DEPLOY: Record<Phase, { core: number; leverage: number }> = {
  HEAT: { core: 0, leverage: 0 },
  PERFECT: { core: 0.7, leverage: 0.3 },
  HIGH: { core: 0.3, leverage: 0 },
  WATCH: { core: 0.1, leverage: 0 },
  NEUTRAL: { core: 0, leverage: 0 },
};

const CORE_TICKERS = '`VT` `VTI` ／ 投信: オルカン / eMAXIS Slim S&P500';
const LEV_TICKERS = '`SPXL` `TQQQ`';

const KNIFE =
  '⚠️ 3倍ブルは一括禁止。想定DD 原資産-30%→レバ実質-70%級。SKEW>150は「まだ掴むな」。' +
  '弾薬はPoolから（生活/運転資金は不可）。IEG諮問＋小池承認の上で発注。';

const PROBE_NOTE =
  'ℹ️ 打診枠はWATCHの間の上限です。毎日買い増す指示ではありません。3倍ブルはPERFECTまで触らない。';

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
  isProbe: boolean;
};

export function buildDeployPlan(phase: Phase, capital: Capital = DEFAULT_CAPITAL): DeployPlan {
  const r = DEPLOY[phase];
  const coreYen = Math.round(capital.cashPool * r.core);
  const leverageYen = Math.round(capital.cashPool * r.leverage);
  const isProbe = phase === 'WATCH' && coreYen > 0;

  let coreAdvice: string;
  if (coreYen <= 0) {
    coreAdvice = phase === 'HEAT' ? '買わない。むしろ利確して弾薬に戻す局面' : '買わない（弾薬は温存）';
  } else if (phase === 'PERFECT') {
    coreAdvice = '成行一括で拾う（分割しない）';
  } else if (isProbe) {
    coreAdvice = '打診枠。金額は「目標残高」で、既に入れていれば追加なし。一度に入れてよい';
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
    leverageAdvice = '4回に分割・3営業日ごと・各回とも指値。一括厳禁';
  }

  const perName = coreYen / 4;
  return {
    coreYen,
    leverageYen,
    totalYen: coreYen + leverageYen,
    coreAdvice,
    leverageAdvice,
    overSingleCap: perName > capital.maxSingleAsset,
    isProbe,
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
  const poolLabel = p.isProbe ? '打診枠（目標残高）' : '今回投入';
  lines.push(`💰 弾薬 ${yen(capital.cashPool)} → ${poolLabel} ${yen(p.totalYen)}`);
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
  } else if (p.isProbe) {
    lines.push(`• Leverage 3倍ブル: ${p.leverageAdvice}`);
  }

  lines.push('');
  lines.push(p.leverageYen > 0 ? KNIFE : PROBE_NOTE);
  return lines.join('\n');
}
