import { describe, it, expect } from 'vitest';
import { planOrder, tranchesFor, SAFETY_MARGIN } from './share-plan';

const PRICES = { VT: 20000, VIG: 32000, XLV: 23000, XLP: 12000, QQQ: 90000, SPXL: 25000, TQQQ: 12000 };

describe('tranchesFor', () => {
  it('HIGH は弾薬の30%を3回に分ける。F&G 10 は段階3の割合', () => {
    const [t] = tranchesFor('HIGH', 300000, 10);
    expect(t.times).toBe(3);
    expect(t.budgetYen).toBe(30000);
    expect(t.buckets).toEqual({ main: 16500, def: 6000, rebound: 7500 });
  });
  it('PERFECT は主力側を一括、3倍ブルを4回に分ける', () => {
    const ts = tranchesFor('PERFECT', 1000000, 5);
    expect(ts.map(t => [t.kind, t.times, t.budgetYen])).toEqual([['core', 1, 700000], ['leverage', 4, 75000]]);
  });
  it('NEUTRAL と HEAT は買わない', () => {
    expect(tranchesFor('NEUTRAL', 300000, 50)).toEqual([]);
    expect(tranchesFor('HEAT', 300000, 80)).toEqual([]);
  });
  it('F&Gが取れない時は全部を主力にする', () => {
    expect(tranchesFor('HIGH', 300000, null)[0].buckets).toEqual({ main: 30000, def: 0, rebound: 0 });
  });
});

describe('planOrder', () => {
  it('使う額は1回分の98%を超えない', () => {
    for (const budget of [10000, 30000, 90000, 300000, 700000]) {
      const p = planOrder(budget, { main: budget * 0.55, def: budget * 0.2, rebound: budget * 0.25 }, PRICES);
      expect(p.etfYen + p.fundYen).toBeLessThanOrEqual(Math.floor(budget * (1 - SAFETY_MARGIN)));
      expect(p.leftoverYen).toBeGreaterThanOrEqual(0);
    }
  });
  it('1株が目安額より高すぎる銘柄は買わず、投信に回す', () => {
    const p = planOrder(30000, { main: 16500, def: 6000, rebound: 7500 }, PRICES);
    expect(p.etfs.find(l => l.ticker === 'VT')?.shares).toBe(1);
    expect(p.etfs.find(l => l.ticker === 'QQQ')?.shares).toBe(0);
    expect(p.funds.map(f => f.bucket).sort()).toEqual(['def', 'rebound']);
    expect(p.funds.every(f => f.yen % 100 === 0)).toBe(true);
  });
  it('額が大きければ割合どおりに近づく', () => {
    const p = planOrder(1000000, { main: 550000, def: 200000, rebound: 250000 }, PRICES);
    const main = p.etfs.filter(l => l.bucket === 'main').reduce((s, l) => s + l.costYen, 0);
    expect(Math.abs(main - 550000)).toBeLessThanOrEqual(20000);
    expect(p.etfs.find(l => l.ticker === 'XLP')!.shares).toBeGreaterThan(0);
  });
  it('株価が取れない銘柄は0株にして、その分を投信に回す', () => {
    const p = planOrder(100000, { main: 100000 }, { VT: null });
    expect(p.etfs[0].shares).toBe(0);
    expect(p.funds).toEqual([{ bucket: 'main', name: 'オルカン', yen: 98000 }]);
  });
  it('3倍ブルの余りは投信に回さない', () => {
    const p = planOrder(75000, { leverage: 75000 }, PRICES);
    expect(p.funds).toEqual([]);
    expect(p.etfYen).toBeLessThanOrEqual(73500);
  });
});

describe('planOrder の選び方（2026-11-21 の不具合）', () => {
  it('守りの3等分では、目安額に近い安い銘柄を先に買う', () => {
    // 300万円・段階3・HIGH の1回分（守りは各2万円）。XLP（約1.4万円）を0株にして VIG（約3.7万円）を買わない。
    const prices = { VT: 22529, VIG: 37371, XLV: 28111, XLP: 14346, QQQ: 96459 };
    const p = planOrder(300000, { main: 165000, def: 60000, rebound: 75000 }, prices);
    const n = (t: string) => p.etfs.find(l => l.ticker === t)!.shares;
    expect(n('XLP')).toBeGreaterThanOrEqual(1);
    expect(n('VIG')).toBe(0);
  });
  it('ずれの合計は「一番足りない順」より小さい', () => {
    const prices = { VT: 22529, VIG: 37371, XLV: 28111, XLP: 14346, QQQ: 96459 };
    const p = planOrder(300000, { main: 165000, def: 60000, rebound: 75000 }, prices);
    const err = p.etfs.reduce((s, l) => s + Math.abs(l.targetYen - l.costYen), 0);
    // 旧方式: VT7・VIG1・QQQ1 で ずれ合計 = 7296+17371+20000+20000+21459 = 86126
    expect(err).toBeLessThan(86126);
  });
});
