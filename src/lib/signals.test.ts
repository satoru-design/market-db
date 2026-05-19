import { describe, it, expect } from 'vitest';
import { detectPhase } from './signals';

describe('detectPhase', () => {
  it('HEAT when F&G >= 75', () => {
    expect(detectPhase({ fg: 80, vix: 15, skew: 130 })).toBe('HEAT');
  });
  it('PERFECT when all 3 BUY signals active', () => {
    expect(detectPhase({ fg: 20, vix: 30, skew: 110 })).toBe('PERFECT');
  });
  it('HIGH when 2 BUY signals active', () => {
    expect(detectPhase({ fg: 20, vix: 30, skew: 130 })).toBe('HIGH');
  });
  it('WATCH when 1 BUY signal active', () => {
    expect(detectPhase({ fg: 20, vix: 20, skew: 130 })).toBe('WATCH');
  });
  it('NEUTRAL when no BUY signals and F&G < 75', () => {
    expect(detectPhase({ fg: 50, vix: 20, skew: 130 })).toBe('NEUTRAL');
  });
  it('境界: F&G=30 は BUY シグナル on', () => {
    expect(detectPhase({ fg: 30, vix: 20, skew: 130 })).toBe('WATCH');
  });
  it('境界: VIX=28 は BUY シグナル on', () => {
    expect(detectPhase({ fg: 50, vix: 28, skew: 130 })).toBe('WATCH');
  });
  it('境界: Skew=118 は BUY シグナル on', () => {
    expect(detectPhase({ fg: 50, vix: 20, skew: 118 })).toBe('WATCH');
  });
});
