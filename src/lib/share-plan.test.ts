import { describe, it, expect } from 'vitest';
import { planOrder, tranchesFor, SAFETY_MARGIN, formatSharesForSlack } from './share-plan';

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
  // 2026-11-26 戻りを QQQ・XLK・SMH の3等分にしたので、株価に XLK・SMH を足した（11/17の終値を円にした値）。
  const prices = { VT: 22529, VIG: 37371, XLV: 28111, XLP: 14346, QQQ: 96459, XLK: 25400, SMH: 71600, COPX: 9300, SPHB: 19200 };
  const buckets = { main: 165000, def: 60000, rebound: 75000 };

  it('守りの3等分では、目安額に近い安い銘柄を先に買う', () => {
    // 300万円・段階3・HIGH の1回分（守りは各2万円）。以前は XLP（約1.4万円）が0株で VIG（約3.7万円）が1株だった。
    const p = planOrder(300000, buckets, prices);
    const n = (t: string) => p.etfs.find(l => l.ticker === t)!.shares;
    expect(n('XLP')).toBeGreaterThanOrEqual(1);
    expect(n('XLP')).toBeGreaterThanOrEqual(n('VIG'));
  });
  // 旧方式（一番足りない銘柄から1株ずつ）を同じ条件でなぞり、ずれの合計を返す。
  const oldWayErr = (budget: number, p: ReturnType<typeof planOrder>) => {
    const lines = p.etfs.map(l => ({ target: l.targetYen, price: l.priceYen ?? Infinity, cost: 0 }));
    let left = Math.floor(budget * (1 - SAFETY_MARGIN));
    for (;;) {
      const c = lines.filter(l => l.price <= left && l.target - l.cost > 0).sort((a, b) => (b.target - b.cost) - (a.target - a.cost))[0];
      if (!c) break;
      c.cost += c.price;
      left -= c.price;
    }
    return lines.reduce((s, l) => s + Math.abs(l.target - l.cost), 0);
  };
  const errOf = (p: ReturnType<typeof planOrder>) => p.etfs.reduce((s, l) => s + Math.abs(l.targetYen - l.costYen), 0);

  it('ずれの合計は「一番足りない順」を超えない', () => {
    const p = planOrder(300000, buckets, prices);
    expect(errOf(p)).toBeLessThanOrEqual(oldWayErr(300000, p));
  });
  it('11/21 の不具合の形（守りだけ・各2万円）では「一番足りない順」よりずれが小さい', () => {
    const p = planOrder(61300, { def: 60000 }, prices);
    expect(errOf(p)).toBeLessThan(oldWayErr(61300, p));
  });
});

describe('戻りは QQQ・XLK・SMH・COPX・SPHB の5等分（2026-11-26）', () => {
  it('戻りの目安額を5本に等分する', () => {
    const p = planOrder(300000, { rebound: 75000 }, { QQQ: 96459, XLK: 25400, SMH: 71600, COPX: 9300, SPHB: 19200 });
    expect(p.etfs.filter(l => l.bucket === 'rebound').map(l => [l.ticker, l.targetYen])).toEqual([
      ['QQQ', 15000], ['XLK', 15000], ['SMH', 15000], ['COPX', 15000], ['SPHB', 15000],
    ]);
    // 1株が目安額に近い COPX（約9,300円）と SPHB（約19,200円）は株で買える。
    expect(p.etfs.find(l => l.ticker === 'COPX')!.shares).toBeGreaterThanOrEqual(1);
    expect(p.etfs.find(l => l.ticker === 'SPHB')!.shares).toBe(1);
  });
});

describe('守りは VIG・XLV・XLP・GLDM・TLT の5等分（2026-11-26）', () => {
  it('守りの目安額を5本に等分する', () => {
    // GLDM は11/25の終値 70.69ドル × 159.18円。
    const p = planOrder(300000, { def: 300000 }, { VIG: 37371, XLV: 28111, XLP: 14346, GLDM: 11252, TLT: 13091 });
    expect(p.etfs.map(l => [l.ticker, l.targetYen])).toEqual([
      ['VIG', 60000], ['XLV', 60000], ['XLP', 60000], ['GLDM', 60000], ['TLT', 60000],
    ]);
    expect(p.etfs.find(l => l.ticker === 'GLDM')!.shares).toBe(5);
    expect(p.etfs.find(l => l.ticker === 'TLT')!.shares).toBe(5);
  });
  it('守りの目安が1本6,250円なら GLDM は1株買える（GLD だと0株で VYM に回っていた）', () => {
    const p = planOrder(31250, { def: 31250 }, { VIG: 38687, XLV: 29240, XLP: 14693, GLDM: 11252, TLT: 13091 });
    expect(p.etfs.find(l => l.ticker === 'GLDM')!.shares).toBe(1);
  });
});

describe('formatSharesForSlack', () => {
  const prices = { VT: 22529, VIG: 37371, XLV: 28111, XLP: 14346, QQQ: 96459, SPXL: 32000, TQQQ: 6531 };
  it('11/21 朝の条件（弾薬30万円・HIGH・F&G 10）で VT 1株と投信2本を出す', () => {
    const s = formatSharesForSlack('HIGH', 300000, 10, prices, '株価は11/21 06:00の値')!;
    expect(s).toContain('1回30,000円・同じ注文を3回');
    expect(s).toContain('`VT` 1株  22,529円');
    expect(s).toContain('投信 楽天・VYM');
    expect(s).toContain('0株：VIG・XLV・XLP・GLDM・TLT・QQQ・XLK・SMH・COPX・SPHB');
  });
  it('買わないフェーズは何も足さない', () => {
    expect(formatSharesForSlack('NEUTRAL', 300000, 50, prices, 'x')).toBeNull();
  });
  it('株価が取れない時は、出せない理由を書く', () => {
    expect(formatSharesForSlack('HIGH', 300000, 10, null, 'x')).toContain('株価が取れなかった');
  });
  it('PERFECT は3倍ブルの段も出す', () => {
    const s = formatSharesForSlack('PERFECT', 1000000, 5, prices, 'x')!;
    expect(s).toContain('1回700,000円・一括');
    expect(s).toContain('3倍ブル*（1回75,000円・同じ注文を4回）');
  });
});

describe('3倍ブルの0株の説明', () => {
  it('3倍ブルの段では「投信で埋めている」と書かない', () => {
    const s = formatSharesForSlack('PERFECT', 300000, 5, { VT: 22529, VIG: 37371, XLV: 28111, XLP: 14346, QQQ: 96459, SPXL: 32000, TQQQ: 6531 }, 'x')!;
    const lev = s.split('\n\n').find(p => p.includes('3倍ブル'))!;
    expect(lev).toContain('0株：SPXL');
    expect(lev).not.toContain('投信で埋めている');
  });
});
