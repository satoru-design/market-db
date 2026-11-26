// 暴落の深さを F&G で3段階に分け、段階ごとに「何を・どの割合で」買うかを決める。
// サイトの表（FgStagePanel）と Slack 通知（buy-action）の両方がここを読む。
// 割合をここ以外に書かないこと。2か所に書くと、画面と通知が食い違う。
//
// 2026-11-21 小池の依頼で追加。根拠（Yahoo日足・配当込み・VIX≥28 の回の初日に買って1年後）:
//   2008-07以降19回  VT 中央値+9% 最悪-28% ／ VIG +15% 最悪-20% ／ QQQ +20% 最悪-26%
//   長い下げ相場の入口（2008-01）  VT系 -35%前後 ／ VIG -26% ／ QQQ -37%
//   2000-04 に QQQ を買うと1年後 -65%
//  「普通の暴落か、何年も続く下げ相場か」は買う日に見分けられない（200日平均などで
//   絞っても 2000年・2008年は避けられなかった）。なので、どの段階でも主力を半分以上に保ち、
//   恐怖が深いほど戻りの速い QQQ を少し足し、守りの VIG を少し減らす。
//
// 2026-11-21 守りを VIG だけから VIG・XLV・XLP の3等分へ広げた（小池の決定）。
//  62銘柄の総ざらいで、XLV（ヘルスケア）と XLP（生活必需品）は VIG より下げ相場の傷が浅かった。
//   2008-07以降19回の1年後  VIG 最悪-20% ／ XLV -16% ／ XLP -13%
//   2000-04・2000-10・2001-09・2007-11・2008-01 の入口で買った平均  VIG -27% ／ XLV -14% ／ XLP -7%
//
// 2026-11-26 戻りを QQQ だけから QQQ・XLK・SMH の3等分へ広げた（小池の決定）。
//  128銘柄に広げて Codex と壁打ちし、数え方を直した（翌営業日に買う・円建て・保有期間が重ならない8回だけ）。
//  直す前は SMH の平均が高く見えたが、2020年+87%・2015年+44%の2回が押し上げていただけだった。
//  上の 2026-11-21 の数字は直す前の数え方（同じ日の終値で買う・19回が重なる）なので、比べる時は注意。
//
// 2026-11-26 守りに GLD（金）を足して VIG・XLV・XLP・GLD の4等分にした（小池の決定）。
//  直した数え方（翌営業日・円建て・重ならない8回）の中央値／最悪
//   VIG +11%／-25% ・ XLV +3%／-23% ・ XLP +6%／-19% ・ GLD +11%／-14%
//  下げの入口（2007-11-26・2008-01-22）  VIG -35%・-39% ／ XLV -38%・-34% ／ XLP -25%・-28% ／ GLD -12%・-20%
//  GLD は2004年11月の上場なので2000〜01年の入口は測れていない。分配金は無く、経費率は0.40%。
//
// 段階のしきい値（30・20・10）は F&G の過去データが取れず、検証していない。
// 30 は既存の買いシグナル（F&G≤30）に合わせた。

export type Sleeve = 'main' | 'def' | 'rebound';

export type FgStage = {
  stage: 1 | 2 | 3;
  name: string;
  range: string;
  max: number; // この値以下ならこの段階（下の段階から順に当てる）
  mix: Record<Sleeve, number>;
};

export const FG_STAGES: FgStage[] = [
  { stage: 1, name: '恐怖', range: 'F&G 21〜30', max: 30, mix: { main: 0.7, def: 0.3, rebound: 0 } },
  { stage: 2, name: '強い恐怖', range: 'F&G 11〜20', max: 20, mix: { main: 0.6, def: 0.25, rebound: 0.15 } },
  { stage: 3, name: '極度の恐怖', range: 'F&G 0〜10', max: 10, mix: { main: 0.55, def: 0.2, rebound: 0.25 } },
];

export const SLEEVES: Record<Sleeve, { label: string; role: string; etf: string; fund: string; basis: string }> = {
  main: {
    label: '主力',
    role: '戻りの土台',
    etf: 'VT・VTI',
    fund: 'オルカン／eMAXIS Slim S&P500',
    basis: '有事に買って1年後 中央値+9%・最悪-28%（VT）',
  },
  def: {
    label: '守り',
    role: '下げ相場の保険',
    etf: 'VIG・XLV・XLP・GLD を4等分（XLV の代わりに VHT でも可）',
    fund: '楽天・VYM',
    basis: '翌営業日に買って1年後（円・重ならない8回）の中央値／最悪 VIG +11%／-25%・XLV +3%／-23%・XLP +6%／-19%・GLD +11%／-14%。2007〜08年の下げの入口で買っても GLD -12%〜-20%（VIG -35%〜-39%）',
  },
  rebound: {
    label: '戻り',
    role: 'V字の戻りを取る',
    etf: 'QQQ・XLK・SMH・COPX・SPHB を5等分',
    fund: 'NASDAQ100に連動する投信',
    basis: '翌営業日に買って1年後（円・重ならない回）の中央値／最悪 QQQ +6%／-25%・XLK +7%／-23%・SMH +7%／-28%（各8回）、COPX +10%／-22%（6回）・SPHB +3%／-3%（5回）。COPX と SPHB は回数が少なく確かさが落ちる。2000年4月に QQQ を買うと-65%',
  },
};

export const SLEEVE_ORDER: Sleeve[] = ['main', 'def', 'rebound'];

// F&G が30より上なら null（暴落局面ではない）。
export function fgStage(fg: number): FgStage | null {
  if (!Number.isFinite(fg)) return null;
  for (const s of [...FG_STAGES].reverse()) {
    if (fg <= s.max) return s;
  }
  return null;
}

// 金額を段階の割合で分ける。端数は主力に寄せ、合計が必ず元の額に一致するようにする。
export function splitByStage(totalYen: number, stage: FgStage | null): Record<Sleeve, number> {
  if (!stage || totalYen <= 0) return { main: totalYen, def: 0, rebound: 0 };
  const def = Math.round(totalYen * stage.mix.def);
  const rebound = Math.round(totalYen * stage.mix.rebound);
  return { main: totalYen - def - rebound, def, rebound };
}
