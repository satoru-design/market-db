import { describe, it, expect } from 'vitest';
import { calcChangePct, formatSnapshot, type IndexSnapshot } from './market-snapshot';

describe('calcChangePct', () => {
  it('上昇を正のパーセントで返す', () => {
    expect(calcChangePct(105, 100)).toBeCloseTo(0.05);
  });
  it('下落を負のパーセントで返す', () => {
    expect(calcChangePct(95, 100)).toBeCloseTo(-0.05);
  });
  it('prev が 0/null/undefined なら null', () => {
    expect(calcChangePct(100, 0)).toBeNull();
    expect(calcChangePct(100, null)).toBeNull();
  });
});

describe('formatSnapshot', () => {
  it('全指数あり: 1行にまとめる', () => {
    const snap: IndexSnapshot = {
      n225: { price: 38920, changePct: -0.012 },
      topx: { price: 2710, changePct: -0.008 },
      gspc: { price: 5250, changePct: 0.008 },
      dji: { price: 38500, changePct: 0.005 },
      ixic: { price: 16800, changePct: 0.011 },
      usdjpy: { price: 154.20, changePct: -0.003 },
    };
    const out = formatSnapshot(snap);
    expect(out).toContain('日経 38,920 (-1.2%)');
    expect(out).toContain('ナス 16,800 (+1.1%)');
    expect(out).toContain('USDJPY 154.20');
  });
  it('一部 null は -- 表示で継続', () => {
    const snap: IndexSnapshot = {
      n225: null,
      topx: { price: 2710, changePct: -0.008 },
      gspc: null,
      dji: { price: 38500, changePct: 0.005 },
      ixic: { price: 16800, changePct: 0.011 },
      usdjpy: { price: 154.20, changePct: -0.003 },
    };
    const out = formatSnapshot(snap);
    expect(out).toContain('日経 --');
    expect(out).toContain('S&P --');
  });
});
