import { describe, it, expect } from 'vitest';
import { buildAlertBlocks, summaryLine, type AlertInput } from './alert-blocks';

// 2026-10-18 の書き直し。それまでの通知の冗長さは3つだった。
//
//  1. `phase_change` と `perfect_now` が同じ本文を付けて2通届いていた
//  2. 同じ指標が1通の中に2回出ていた（見出しと本文）
//  3. PERFECT の夜は閾値アラートを含めて最大4通になっていた
//
// 手本は「見つける君_KPIサマリ」。ラベルと値を分け、絵文字を並べず、
// URL は貼らずにボタンにする。

const CAP = { cashPool: 1000000, maxSingleAsset: 200000 };
const AT = new Date('2026-10-18T05:43:00+09:00');

function base(over: Partial<AlertInput> = {}): AlertInput {
  return {
    phase: 'PERFECT', prevPhase: 'WATCH',
    fg: 15, vix: 32.4, skew: 114, signalsActive: 3,
    capital: CAP, url: 'https://example.test/alert', at: AT,
    ...over,
  };
}

const flat = (m: { blocks: Record<string, unknown>[] }) => JSON.stringify(m.blocks);

describe('通知一覧に出る1行', () => {
  it('フェーズ・時刻・指標・いくら動かすかが1行で揃う', () => {
    const t = summaryLine(base());
    expect(t).toContain('PERFECT');
    expect(t).toContain('2026/10/18');
    expect(t).toContain('F&G15');
    expect(t).toContain('VIX32.4');
    expect(t).toContain('SKEW114');
    expect(t).toContain('100.0万円');
  });

  it('動かさない局面は「投入なし」と言い切る', () => {
    expect(summaryLine(base({ phase: 'NEUTRAL', prevPhase: 'HIGH' }))).toContain('投入なし');
  });

  it('WATCH は打診枠と分かる', () => {
    expect(summaryLine(base({ phase: 'WATCH', prevPhase: 'NEUTRAL' }))).toContain('打診枠');
  });
});

describe('冗長さを持ち込まない', () => {
  it('指標は1回しか出さない', () => {
    const s = flat(buildAlertBlocks(base()));
    // 値そのものの出現回数を数える（fields に1回だけ）
    expect(s.split('32.4').length - 1).toBe(1);
    expect(s.split('114').length - 1).toBe(1);
  });

  it('フェーズ名を本文で繰り返さない', () => {
    const s = flat(buildAlertBlocks(base()));
    expect(s.split('PERFECT').length - 1).toBe(1);
  });

  it('生URLを本文に貼らずボタンにする', () => {
    const m = buildAlertBlocks(base());
    const actions = m.blocks.filter(b => b.type === 'actions');
    expect(actions).toHaveLength(1);
    const sections = m.blocks.filter(b => b.type === 'section');
    expect(JSON.stringify(sections)).not.toContain('https://');
  });

  it('絵文字を並べない（見出しの丸1つまで）', () => {
    const s = flat(buildAlertBlocks(base()));
    const emoji = s.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? [];
    expect(emoji.length).toBeLessThanOrEqual(1);
  });

  it('キメ台詞を使わない', () => {
    const s = flat(buildAlertBlocks(base()));
    for (const ng of ['千載一遇', 'ショットOK', '——']) {
      expect(s).not.toContain(ng);
    }
  });
});

describe('規律は落とさない', () => {
  it('PERFECT はレバの分割と一括禁止を必ず言う', () => {
    const s = flat(buildAlertBlocks(base()));
    expect(s).toContain('分割');
    expect(s).toContain('一括厳禁');
    expect(s).toContain('一括禁止');
    expect(s).toContain('IEG諮問');
  });

  it('レバを出さない局面では3倍ブルの銘柄を出さない', () => {
    const s = flat(buildAlertBlocks(base({ phase: 'HIGH', prevPhase: 'WATCH' })));
    expect(s).not.toContain('SPXL');
    expect(s).not.toContain('一括禁止');
  });

  it('1銘柄上限を超えたら警告を出す', () => {
    const s = flat(buildAlertBlocks(base({ capital: { ...CAP, cashPool: 2000000 } })));
    expect(s).toContain('1銘柄上限');
  });

  it('積立が自動で続いていることは毎回出す', () => {
    for (const phase of ['PERFECT', 'HIGH', 'WATCH', 'NEUTRAL', 'HEAT'] as const) {
      expect(flat(buildAlertBlocks(base({ phase })))).toContain('積立は自動');
    }
  });

  it('投入ゼロの局面は「動かさない」と出す', () => {
    const s = flat(buildAlertBlocks(base({ phase: 'NEUTRAL' })));
    expect(s).toContain('動かさない');
  });

  it('HEAT を「動かさない」で括らない（売る局面である）', () => {
    // 見出しは「利確して現金に戻す」なのに本文が「動かさない」だと矛盾する。
    const s = flat(buildAlertBlocks(base({ phase: 'HEAT' })));
    expect(s).not.toContain('動かさない');
    expect(s).toContain('利確');
    expect(s).toContain('全決済');
  });
});

describe('文脈', () => {
  it('どこから変化したかを出す', () => {
    expect(flat(buildAlertBlocks(base()))).toContain('WATCH から変化');
  });

  it('同じフェーズのままなら「変化」とは言わない', () => {
    const s = flat(buildAlertBlocks(base({ prevPhase: 'PERFECT' })));
    expect(s).not.toContain('から変化');
  });

  it('畳み込んだ閾値を1行で示す', () => {
    const s = flat(buildAlertBlocks(base({ triggers: ['vix_spike', 'fg_panic'] })));
    expect(s).toContain('VIX>30');
    expect(s).toContain('F&G<20');
  });

  it('テストの断りは本文でなく上の小さい行に置く', () => {
    const m = buildAlertBlocks(base({ testNote: 'これはテストです。実際の相場ではありません' }));
    expect(m.blocks[0].type).toBe('context');
    expect(JSON.stringify(m.blocks[0])).toContain('テストです');
  });

  it('URLが無ければボタンを出さない', () => {
    const m = buildAlertBlocks(base({ url: undefined }));
    expect(m.blocks.filter(b => b.type === 'actions')).toHaveLength(0);
  });
});

describe('重複を1通にまとめる（route 側の規約）', () => {
  it('phase_change と perfect_now を両方送らない', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '../app/api/cron/alert/route.ts'), 'utf8');
    // 行動つき通知は1つだけ選ぶ
    expect(src).toContain("passed.find(a => a.key === 'phase_change')");
    expect(src).toContain("?? passed.find(a => a.key === 'perfect_now')");
    // 畳み込んだ閾値も発火済みにする（次周で単独再送しない）
    expect(src).toContain('for (const k of triggers) markFired(k)');
  });
});
