import { buildDeployPlan, yen, MONTHLY_TOTAL, type Capital } from './buy-action';
import type { Phase } from './signals';

// 相場アラートの Slack 文面を Block Kit で組む。
//
// 2026-10-18 に書き直した。それまでの通知には3つの冗長があった。
//
//  1. **同じ本文が2通届いていた。** `phase_change` と `perfect_now` が両方
//     発火し、どちらにも `formatBuyAction` の全文を付けていた。
//  2. **同じ指標が1通の中に2回出ていた。** 見出しの `F&G:15 VIX:32.4 Skew:114`
//     と本文の `F&G 15 / VIX 32.4 / SKEW 114`。
//  3. **閾値アラートが別便で飛んでいた。** PERFECT のときは vix_spike /
//     fg_panic / phase_change / perfect_now で最大4通になる。
//
// 手本は「見つける君_KPIサマリ」の通知。ラベルと値を分け、絵文字を並べず、
// URL は貼らずにボタンにする。読む人が最初に知りたいのは
// 「いま動くか」「何にいくらか」の2つだけなので、それを上2段に置く。

export type SlackBlock = Record<string, unknown>;

export type AlertMessage = { text: string; blocks: SlackBlock[] };

const PHASE_HEADLINE: Record<Phase, string> = {
  HEAT: 'HEAT 過熱',
  PERFECT: 'PERFECT 総悲観',
  HIGH: 'HIGH 押し目',
  WATCH: 'WATCH 下落の入口',
  NEUTRAL: 'NEUTRAL 通常',
};

const PHASE_WHAT: Record<Phase, string> = {
  HEAT: '利確して現金に戻す',
  PERFECT: '最大の買い場',
  HIGH: '押し目を買う',
  WATCH: '打診枠のみ',
  NEUTRAL: '積立だけ',
};

const PHASE_MARK: Record<Phase, string> = {
  HEAT: '🔴',
  PERFECT: '🟢',
  HIGH: '🟢',
  WATCH: '🟡',
  NEUTRAL: '⚪',
};

/** 同じ局面で前に出した通知の記録。 */
export type LastSent = {
  phase: Phase;
  at: string;       // ISO
  totalYen: number;
  count: number;    // この局面に入ってから出した回数（今回を含まない）
};

export type AlertInput = {
  phase: Phase;
  prevPhase?: Phase | null;
  fg: number;
  vix: number;
  skew: number;
  signalsActive: number;
  capital: Capital;
  url?: string;
  /** 発火した閾値アラート（vix_spike / fg_panic / skew_high）。別便にせず畳み込む。 */
  triggers?: string[];
  at?: Date;
  testNote?: string;
  /** 同じ局面で前に出した通知。2通目以降であることを示すために使う。 */
  lastSent?: LastSent | null;
};

function stamp(at: Date): string {
  const f = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return f.format(at).replace(/\//g, '/');
}

const TRIGGER_LABEL: Record<string, string> = {
  vix_spike: 'VIX>30',
  fg_panic: 'F&G<20',
  skew_high: 'SKEW>150',
};

/** 通知一覧とロック画面に出る1行。ここだけで判断できる並びにする。 */
export function summaryLine(i: AlertInput): string {
  const at = i.at ?? new Date();
  const p = buildDeployPlan(i.phase, i.capital);
  const move = p.totalYen > 0
    ? `${p.isProbe ? '打診枠' : '投入'} ${yen(p.totalYen)}`
    : '投入なし';
  // 2通目以降は一覧の時点で分かるようにする。本文を開かないと
  // 再掲だと気づけないなら、一覧に出す意味が薄い。
  const ls = i.lastSent;
  const again = ls && ls.phase === i.phase && p.totalYen > 0
    ? `・${ls.count + 1}回目`
    : '';
  return `相場 ${PHASE_HEADLINE[i.phase]}（${stamp(at)}）`
    + `F&G${i.fg}・VIX${i.vix}・SKEW${i.skew}・${move}${again}`;
}

export function buildAlertBlocks(i: AlertInput): AlertMessage {
  const at = i.at ?? new Date();
  const p = buildDeployPlan(i.phase, i.capital);
  const blocks: SlackBlock[] = [];

  if (i.testNote) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `:test_tube: ${i.testNote}` }],
    });
  }

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${PHASE_MARK[i.phase]} ${PHASE_HEADLINE[i.phase]} ・ ${PHASE_WHAT[i.phase]}`,
      emoji: true,
    },
  });

  // 文脈の1行。いつ・どこから来たか・何本点いたか。
  const ctx: string[] = [`${stamp(at)} JST 時点`];
  if (i.prevPhase && i.prevPhase !== i.phase) ctx.push(`${i.prevPhase} から変化`);
  ctx.push(`買いシグナル ${i.signalsActive}/3`);
  const trips = (i.triggers ?? []).map(t => TRIGGER_LABEL[t]).filter(Boolean);
  if (trips.length) ctx.push(`閾値 ${trips.join('・')}`);
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: ctx.join(' ・ ') }] });

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*F&G*\n${i.fg}` },
      { type: 'mrkdwn', text: `*VIX*\n${i.vix}` },
      { type: 'mrkdwn', text: `*SKEW*\n${i.skew}` },
      { type: 'mrkdwn', text: `*弾薬*\n${yen(i.capital.cashPool)}` },
    ],
  });

  blocks.push({ type: 'divider' });

  if (p.totalYen <= 0) {
    // 「買わない」と「売る」を同じ見出しで括らない。HEAT は動く局面である。
    // 一度 `動かさない` で括ったら、見出しの「利確して現金に戻す」と
    // 本文が正面から矛盾した。描いたものを実際に出して気づいた。
    const head = i.phase === 'HEAT' ? '買わずに、利確して弾薬へ戻す' : '動かさない';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${head}*\nCore: ${p.coreAdvice}\n3倍ブル: ${p.leverageAdvice}`,
      },
    });
  } else {
    // 再掲で「今回投入」と書くと、下の「積み増しではない」と正面から矛盾する。
    // 見出しの側を変える（註で打ち消すより、最初から矛盾させない）。
    const repeat = !!(i.lastSent && i.lastSent.phase === i.phase);
    const head = p.isProbe
      ? '打診枠（目標残高）'
      : repeat ? '投入計画（前回から変わらず）' : '今回投入';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${head} ${yen(p.totalYen)}*` },
    });

    if (p.coreYen > 0) {
      const warn = p.overSingleCap
        ? `\n1銘柄上限 ${yen(i.capital.maxSingleAsset)} 超。銘柄を分けるか注文を割る`
        : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Core 全世界/全米*  ${yen(p.coreYen)}\n`
            + '`VT` `VTI` ／ 投信 オルカン・eMAXIS Slim S&P500\n'
            + `${p.coreAdvice}${warn}`,
        },
      });
    }
    if (p.leverageYen > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Leverage 3倍ブル*  ${yen(p.leverageYen)}\n`
            + '`SPXL` `TQQQ`\n'
            + `${p.leverageAdvice}`,
        },
      });
    }
  }

  // 制約は context に落とす。本文と同じ重さで並べると、毎回読み飛ばされる。
  const notes: string[] = [];

  // 2通目以降であることを先に言う。
  //
  // PERFECT が数日続くと、同じ内容が毎日届く。読む側からは前の通知と
  // 区別がつかないので、2通目から読まれなくなる。
  //
  // **「投入済み」とは書かない。** システムが知っているのは「同じ内容を出した」
  // ことだけで、小池が実際に買ったかどうかは知らない。知らないことを
  // 知っているように書くと、金額の判断がそこで狂う。
  const ls = i.lastSent;
  if (ls && ls.phase === i.phase && p.totalYen > 0) {
    const when = stamp(new Date(ls.at));
    notes.push(
      `この内容を出すのは ${ls.count + 1} 回目です（前回 ${when}）。`
      + '金額は毎回おなじ計画で、積み増しの指示ではありません。'
      + '実行済みなら追加はありません',
    );
  }

  notes.push(`積立は自動（月${yen(MONTHLY_TOTAL)}）で継続中。操作不要`);
  if (p.leverageYen > 0) {
    notes.push(
      '3倍ブルは一括禁止。想定DD 原資産-30%でレバ実質-70%級。'
      + 'SKEW>150 は掴まない。弾薬はPoolから（生活・運転資金は不可）。'
      + 'IEG諮問と小池承認の上で発注',
    );
  } else if (p.isProbe) {
    notes.push('打診枠は WATCH の間の上限。毎日買い増す指示ではない。3倍ブルは PERFECT まで触らない');
  }
  blocks.push({
    type: 'context',
    elements: notes.map(text => ({ type: 'mrkdwn', text })),
  });

  if (i.url) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '市況を開く', emoji: false },
        url: i.url,
      }],
    });
  }

  return { text: summaryLine(i), blocks };
}
