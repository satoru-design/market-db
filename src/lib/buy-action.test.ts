import { describe, it, expect } from 'vitest';
import { formatBuyAction, buildPlan, parseBudgetYen, DEPRECATED_FUNDS, type Capital } from './buy-action';
import { detectPhase, buySignals } from './signals';
import { portfolioData } from '@/data/portfolio';

const CAP: Capital = { monthlyBudget: 500000, cashPool: 3438289, maxSingleAsset: 200000 };
const NO_POOL: Capital = { ...CAP, cashPool: 0 };

const byId = (phase: Parameters<typeof buildPlan>[0], id: string, cap = CAP) =>
  buildPlan(phase, cap).find((p) => p.id === id)!;

describe('parseBudgetYen', () => {
  it('portfolio.ts に実在する全 budget 文字列を円に変換できる', () => {
    expect(parseBudgetYen('20万円/月')).toBe(200000);
    expect(parseBudgetYen('10万円/月 (+ Pool全解放)')).toBe(100000);
    expect(parseBudgetYen('0円/月')).toBe(0);
    expect(parseBudgetYen('0円/月 (配当再投資)')).toBe(0);
    expect(parseBudgetYen('0円/月 (全額放出)')).toBe(0);
  });

  it('全フェーズ・全カテゴリの budget がパース可能で、合計は月50万円になる', () => {
    for (const phase of ['HEAT', 'PERFECT', 'HIGH', 'WATCH', 'NEUTRAL'] as const) {
      const sum = portfolioData.reduce((a, c) => a + parseBudgetYen(c.strategy[phase].budget), 0);
      expect(sum, `${phase} の合計`).toBe(500000);
    }
  });
});

describe('サイジング（決定論的であること）', () => {
  it('Pool投入なしなら合計は月予算に一致する', () => {
    for (const phase of ['HEAT', 'WATCH', 'NEUTRAL'] as const) {
      const total = buildPlan(phase, NO_POOL).reduce((a, p) => a + p.totalYen, 0);
      expect(total, `${phase}`).toBe(500000);
    }
  });

  it('月予算を変えると比例配分される', () => {
    const half = buildPlan('NEUTRAL', { ...NO_POOL, monthlyBudget: 250000 });
    expect(half.reduce((a, p) => a + p.totalYen, 0)).toBe(250000);
    expect(half.find((p) => p.id === 'core')!.totalYen).toBe(100000); // 20万 → 10万
  });

  it('PERFECT は弾薬を全額 Core へ投入する', () => {
    expect(byId('PERFECT', 'core').poolYen).toBe(3438289);
    expect(byId('PERFECT', 'growth').poolYen).toBe(0);
  });

  it('HIGH は弾薬の30%を Growth へ投入する', () => {
    expect(byId('HIGH', 'growth').poolYen).toBe(Math.round(3438289 * 0.3));
    expect(byId('HIGH', 'core').poolYen).toBe(0);
  });

  it('NEUTRAL / WATCH / HEAT は弾薬を投入しない（温存）', () => {
    for (const phase of ['NEUTRAL', 'WATCH', 'HEAT'] as const) {
      const deployed = buildPlan(phase, CAP).reduce((a, p) => a + p.poolYen, 0);
      expect(deployed, `${phase}`).toBe(0);
    }
  });
});

describe('エントリー方式（ショット vs 分割）', () => {
  it('レバレッジは買う局面では必ず SPLIT（ショット禁止）', () => {
    expect(byId('PERFECT', 'leverage').mode).toBe('SPLIT');
    expect(byId('HIGH', 'leverage').mode).toBe('SPLIT');
    expect(byId('PERFECT', 'leverage').advice).toContain('一括厳禁');
    expect(byId('HIGH', 'leverage').advice).toContain('一括厳禁');
  });

  it('レバレッジは NEUTRAL / WATCH では買わない', () => {
    expect(byId('NEUTRAL', 'leverage').totalYen).toBe(0);
    expect(byId('WATCH', 'leverage').totalYen).toBe(0);
    expect(byId('NEUTRAL', 'leverage').mode).toBe('NONE');
  });

  it('PERFECT の非レバは SHOT（成行一括）', () => {
    expect(byId('PERFECT', 'core').mode).toBe('SHOT');
    expect(byId('PERFECT', 'growth').mode).toBe('SHOT');
  });

  it('HIGH の非レバは SPLIT（分割・指値）', () => {
    expect(byId('HIGH', 'core').mode).toBe('SPLIT');
    expect(byId('HIGH', 'growth').advice).toContain('分割');
  });

  it('NEUTRAL は MONTHLY（毎月の積立・刻まない）', () => {
    expect(byId('NEUTRAL', 'core').mode).toBe('MONTHLY');
    expect(byId('NEUTRAL', 'core').advice).toContain('自動積立');
  });

  it('HEAT の Growth は SELL（利確検討）を返す', () => {
    expect(byId('HEAT', 'growth').mode).toBe('SELL');
    expect(byId('HEAT', 'leverage').mode).toBe('SELL');
  });
});

describe('銘柄コード（ティッカー）', () => {
  it('レバレッジは SPXL / TQQQ を出す', () => {
    expect(byId('PERFECT', 'leverage').tickers).toEqual(['SPXL', 'TQQQ']);
  });

  it('Core は VT / VTI、Growth は QQQ を出す', () => {
    expect(byId('NEUTRAL', 'core').tickers).toContain('VT');
    expect(byId('NEUTRAL', 'core').tickers).toContain('VTI');
    expect(byId('NEUTRAL', 'growth').tickers).toContain('QQQ');
  });

  it('通知本文にティッカーが含まれる', () => {
    const out = formatBuyAction('PERFECT', CAP);
    expect(out).toContain('SPXL');
    expect(out).toContain('TQQQ');
    expect(out).toContain('QQQ');
  });
});

describe('リスクレール', () => {
  it('1銘柄あたりが上限を超えると overSingleCap が立つ', () => {
    // PERFECT の Core は 弾薬343万 + 月10万 を VT/VTI/投信3本 に割る
    const core = byId('PERFECT', 'core');
    expect(core.totalYen).toBeGreaterThan(200000);
    expect(core.overSingleCap).toBe(true);
    expect(formatBuyAction('PERFECT', CAP)).toContain('1銘柄上限');
  });

  it('落ちるナイフ規律は PERFECT / HIGH にのみ付く', () => {
    expect(formatBuyAction('PERFECT', CAP)).toContain('一括禁止');
    expect(formatBuyAction('HIGH', CAP)).toContain('一括禁止');
    expect(formatBuyAction('NEUTRAL', CAP)).not.toContain('一括禁止');
    expect(formatBuyAction('WATCH', CAP)).not.toContain('一括禁止');
  });
});

describe('積立▲（集約対象）の投信を推奨しない', () => {
  it('全フェーズの通知本文に▲銘柄が一切出てこない', () => {
    for (const phase of ['HEAT', 'PERFECT', 'HIGH', 'WATCH', 'NEUTRAL'] as const) {
      const out = formatBuyAction(phase, CAP);
      for (const fund of DEPRECATED_FUNDS) {
        expect(out, `${phase} に ${fund} が出ている`).not.toContain(fund);
      }
    }
  });

  it('◎/○ の投信は推奨に含まれる', () => {
    const out = formatBuyAction('NEUTRAL', CAP);
    for (const fund of ['オルカン', 'eMAXIS Slim S&P500', 'ニッセイNASDAQ100', '楽天SCHD', 'iTrustインド株式']) {
      expect(out, `${fund} が推奨に無い`).toContain(fund);
    }
  });
});

describe('2026-09-11 時点の実測値', () => {
  const ind = { fg: 33, vix: 17.84, skew: 149.25 };

  it('買いシグナルは3本とも不点灯・フェーズは NEUTRAL', () => {
    expect(buySignals(ind).filter((s) => s.active)).toHaveLength(0);
    expect(detectPhase(ind)).toBe('NEUTRAL');
  });

  it('3倍ブルは 0円・弾薬は投入しない', () => {
    const plans = buildPlan(detectPhase(ind), CAP);
    expect(plans.find((p) => p.id === 'leverage')!.totalYen).toBe(0);
    expect(plans.reduce((a, p) => a + p.poolYen, 0)).toBe(0);
  });

  it('指標行を渡すと通知に出る', () => {
    const out = formatBuyAction(detectPhase(ind), CAP, { ...ind, signalsActive: 0 });
    expect(out).toContain('F&G 33');
    expect(out).toContain('SKEW 149.25');
    expect(out).toContain('買いシグナル 0/3');
  });
});
