import { describe, it, expect } from 'vitest';
import { computeReturns } from './backtest';

const sample = {
  events: [
    { date: '2020-03-23', intensity: 'PERFECT' as const, fg: 2, vix_peak: 82, skew_peak: 110, context: 'A' },
    { date: '2022-10-13', intensity: 'PERFECT' as const, fg: 15, vix_peak: 33, skew_peak: 119, context: 'B' },
  ],
  current_prices: { SPXL: 100 },
  event_prices: {
    '2020-03-23': { SPXL: 10 },
    '2022-10-13': { SPXL: 50 },
  },
};

describe('computeReturns', () => {
  it('累積リターンを正しく計算', () => {
    const result = computeReturns(sample, 'SPXL');
    expect(result.byEvent[0].returnPct).toBeCloseTo(9.0);
    expect(result.byEvent[1].returnPct).toBeCloseTo(1.0);
  });

  it('平均リターンと勝率を計算', () => {
    const result = computeReturns(sample, 'SPXL');
    expect(result.avgReturnPct).toBeCloseTo(5.0);
    expect(result.winRate).toBe(1.0);
  });

  it('価格データなしの資産は空結果', () => {
    const result = computeReturns(sample, 'BTC');
    expect(result.byEvent).toEqual([]);
    expect(result.avgReturnPct).toBe(0);
  });
});
