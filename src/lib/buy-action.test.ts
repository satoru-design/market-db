import { describe, it, expect } from 'vitest';
import {
  formatBuyAction,
  buildDeployPlan,
  MONTHLY_TSUMITATE,
  MONTHLY_TOTAL,
  type Capital,
} from './buy-action';
import { detectPhase, buySignals } from './signals';

const CAP: Capital = { cashPool: 1000000, maxSingleAsset: 200000 };
const NO_POOL: Capital = { cashPool: 0, maxSingleAsset: 200000 };
const ALL: Array<'HEAT' | 'PERFECT' | 'HIGH' | 'WATCH' | 'NEUTRAL'> = [
  'HEAT', 'PERFECT', 'HIGH', 'WATCH', 'NEUTRAL',
];

describe('毎月の積立（自動・判断対象外）', () => {
  it('合計は月10万円', () => {
    expect(MONTHLY_TOTAL).toBe(100000);
  });

  it('2026-09 の確定6本が入っている', () => {
    const names = MONTHLY_TSUMITATE.map(f => f.name).join('|');
    for (const n of ['オルカン', '楽天・VYM', 'ニッセイTOPIX', '大和住銀DC国内株式', 'Tracers S&P1000', '新興国株式']) {
      expect(names, `${n} が積立リストに無い`).toContain(n);
    }
  });

  it('止めた豪州3本は積立リストに含まれない', () => {
    const names = MONTHLY_TSUMITATE.map(f => f.name).join('|');
    for (const n of ['豪州', 'オーストラリア', 'リート']) {
      expect(names, `${n} が残っている`).not.toContain(n);
    }
  });

  it('どのフェーズでも通知に「積立は継続中」が出る', () => {
    for (const phase of ALL) {
      expect(formatBuyAction(phase, CAP)).toContain('継続中');
    }
  });
});

describe('弾薬(cashPool)の投入（決定論的であること）', () => {
  it('PERFECT は全額放出＝Core 70% / レバ 30%', () => {
    const p = buildDeployPlan('PERFECT', CAP);
    expect(p.coreYen).toBe(700000);
    expect(p.leverageYen).toBe(300000);
    expect(p.totalYen).toBe(1000000);
  });

  it('HIGH は3割だけ・Coreのみ（レバは出さない）', () => {
    const p = buildDeployPlan('HIGH', CAP);
    expect(p.coreYen).toBe(300000);
    expect(p.leverageYen).toBe(0);
  });

  it('NEUTRAL / WATCH / HEAT は弾薬を温存する', () => {
    for (const phase of ['NEUTRAL', 'WATCH', 'HEAT'] as const) {
      expect(buildDeployPlan(phase, CAP).totalYen, phase).toBe(0);
    }
  });

  it('弾薬が0なら全フェーズで投入0', () => {
    for (const phase of ALL) {
      expect(buildDeployPlan(phase, NO_POOL).totalYen, phase).toBe(0);
    }
  });

  it('弾薬を増やすと比例して増える', () => {
    const p = buildDeployPlan('PERFECT', { ...CAP, cashPool: 2000000 });
    expect(p.coreYen).toBe(1400000);
    expect(p.leverageYen).toBe(600000);
  });
});

describe('落ちるナイフ規律', () => {
  it('レバレッジを出すのは PERFECT だけ', () => {
    for (const phase of ALL) {
      const lev = buildDeployPlan(phase, CAP).leverageYen;
      if (phase === 'PERFECT') expect(lev).toBeGreaterThan(0);
      else expect(lev, phase).toBe(0);
    }
  });

  it('レバレッジを出すときは必ず分割・一括厳禁と言う', () => {
    const p = buildDeployPlan('PERFECT', CAP);
    expect(p.leverageAdvice).toContain('分割');
    expect(p.leverageAdvice).toContain('一括厳禁');
  });

  it('PERFECT の Core はショット可、HIGH の Core は分割', () => {
    expect(buildDeployPlan('PERFECT', CAP).coreAdvice).toContain('成行一括');
    expect(buildDeployPlan('HIGH', CAP).coreAdvice).toContain('分割');
  });

  it('HEAT はレバを全決済して現金化と言う', () => {
    expect(buildDeployPlan('HEAT', CAP).leverageAdvice).toContain('全決済');
  });

  it('規律の但し書きは投入がある時だけ付く', () => {
    expect(formatBuyAction('PERFECT', CAP)).toContain('一括禁止');
    expect(formatBuyAction('HIGH', CAP)).toContain('一括禁止');
    expect(formatBuyAction('NEUTRAL', CAP)).not.toContain('一括禁止');
  });

  it('1銘柄上限を超えると警告が出る（PERFECTのCore 70万を4本に割ると17.5万で収まる）', () => {
    expect(buildDeployPlan('PERFECT', CAP).overSingleCap).toBe(false);
    expect(buildDeployPlan('PERFECT', { ...CAP, cashPool: 2000000 }).overSingleCap).toBe(true);
    expect(formatBuyAction('PERFECT', { ...CAP, cashPool: 2000000 })).toContain('1銘柄上限');
  });
});

describe('ティッカー表示', () => {
  it('PERFECT では SPXL / TQQQ が出る', () => {
    const out = formatBuyAction('PERFECT', CAP);
    expect(out).toContain('SPXL');
    expect(out).toContain('TQQQ');
  });

  it('レバを出さないフェーズでは SPXL / TQQQ を買えと言わない', () => {
    const out = formatBuyAction('HIGH', CAP);
    expect(out).not.toContain('SPXL');
  });
});

describe('2026-09-11 時点の実測値', () => {
  const ind = { fg: 33, vix: 17.84, skew: 149.25 };

  it('買いシグナル0本・NEUTRAL・弾薬は温存', () => {
    expect(buySignals(ind).filter(s => s.active)).toHaveLength(0);
    expect(detectPhase(ind)).toBe('NEUTRAL');
    expect(buildDeployPlan(detectPhase(ind), CAP).totalYen).toBe(0);
  });

  it('指標行が通知に出る', () => {
    const out = formatBuyAction(detectPhase(ind), CAP, { ...ind, signalsActive: 0 });
    expect(out).toContain('F&G 33');
    expect(out).toContain('SKEW 149.25');
    expect(out).toContain('買いシグナル 0/3');
  });
});
