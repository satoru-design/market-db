import { describe, it, expect } from 'vitest';
import { detectAlerts } from './alerts';

describe('detectAlerts', () => {
  it('VIX>30 で vix_spike', () => {
    const r = detectAlerts({ fg: 50, vix: 32, skew: 135 }, null);
    expect(r.some(a => a.key === 'vix_spike')).toBe(true);
  });
  it('F&G<20 で fg_panic', () => {
    const r = detectAlerts({ fg: 18, vix: 20, skew: 130 }, null);
    expect(r.some(a => a.key === 'fg_panic')).toBe(true);
  });
  it('フェーズ変化検知', () => {
    const r = detectAlerts({ fg: 18, vix: 30, skew: 117 }, 'NEUTRAL');
    expect(r.some(a => a.key === 'phase_change')).toBe(true);
  });
  it('変化なしなら空配列', () => {
    const r = detectAlerts({ fg: 50, vix: 18, skew: 135 }, 'NEUTRAL');
    expect(r).toEqual([]);
  });
});
