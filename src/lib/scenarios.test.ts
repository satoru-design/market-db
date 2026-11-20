import { describe, it, expect } from 'vitest';
import { neighborPhases } from './scenarios';

// 並びは恐怖の深さの順: PERFECT ← HIGH ← WATCH ← NEUTRAL ← HEAT
describe('neighborPhases', () => {
  it('HIGH の隣は PERFECT(もう1段下げ) と WATCH(1段戻す)', () => {
    expect(neighborPhases('HIGH')).toEqual({ worse: 'PERFECT', better: 'WATCH' });
  });
  it('PERFECT はこれより深い段階がない', () => {
    expect(neighborPhases('PERFECT')).toEqual({ worse: null, better: 'HIGH' });
  });
  it('WATCH の隣は HIGH と NEUTRAL', () => {
    expect(neighborPhases('WATCH')).toEqual({ worse: 'HIGH', better: 'NEUTRAL' });
  });
  it('NEUTRAL の隣は WATCH と HEAT', () => {
    expect(neighborPhases('NEUTRAL')).toEqual({ worse: 'WATCH', better: 'HEAT' });
  });
  it('HEAT（過熱）はこれより上がない。下げた先は NEUTRAL', () => {
    expect(neighborPhases('HEAT')).toEqual({ worse: 'NEUTRAL', better: null });
  });
  it('PERFECT の「もう1段下げ」に HEAT を出さない（2026-11-21 の不具合）', () => {
    expect(neighborPhases('PERFECT').worse).not.toBe('HEAT');
  });
});
