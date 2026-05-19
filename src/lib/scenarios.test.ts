import { describe, it, expect } from 'vitest';
import { neighborPhases } from './scenarios';

describe('neighborPhases', () => {
  it('HIGH の隣は PERFECT(悪化) と WATCH(改善)', () => {
    expect(neighborPhases('HIGH')).toEqual({ worse: 'PERFECT', better: 'WATCH' });
  });
  it('HEAT は悪化方向なし', () => {
    expect(neighborPhases('HEAT')).toEqual({ worse: null, better: 'PERFECT' });
  });
  it('NEUTRAL は改善方向なし', () => {
    expect(neighborPhases('NEUTRAL')).toEqual({ worse: 'WATCH', better: null });
  });
  it('PERFECT の隣は HEAT(悪化) と HIGH(改善)', () => {
    expect(neighborPhases('PERFECT')).toEqual({ worse: 'HEAT', better: 'HIGH' });
  });
  it('WATCH の隣は HIGH(悪化) と NEUTRAL(改善)', () => {
    expect(neighborPhases('WATCH')).toEqual({ worse: 'HIGH', better: 'NEUTRAL' });
  });
});
