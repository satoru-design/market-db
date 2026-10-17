import { describe, it, expect } from 'vitest';
import { detectAlerts, lockKeyFor, lockHoursFor } from './alerts';

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

describe('PERFECT を取りこぼさない（2026-10-18 修正）', () => {
  it('PERFECT なら perfect_now が立つ', () => {
    const r = detectAlerts({ fg: 18, vix: 30, skew: 117 }, 'HIGH');
    expect(r.some(a => a.key === 'perfect_now')).toBe(true);
  });

  it('PERFECT でなければ perfect_now は立たない', () => {
    for (const ind of [
      { fg: 18, vix: 20, skew: 168 }, // WATCH
      { fg: 18, vix: 30, skew: 160 }, // HIGH
      { fg: 50, vix: 18, skew: 135 }, // NEUTRAL
    ]) {
      expect(detectAlerts(ind, 'NEUTRAL').some(a => a.key === 'perfect_now')).toBe(false);
    }
  });

  it('遷移の記録が無くても（prevPhase=null）PERFECT は通知される', () => {
    const r = detectAlerts({ fg: 18, vix: 30, skew: 117 }, null);
    expect(r.some(a => a.key === 'phase_change')).toBe(false);
    expect(r.some(a => a.key === 'perfect_now')).toBe(true);
  });
});

describe('通知ロックの鍵（本件の再発防止）', () => {
  it('フェーズ遷移は遷移ごとに別の鍵になる', () => {
    const a = lockKeyFor('phase_change', 'NEUTRAL', 'WATCH');
    const b = lockKeyFor('phase_change', 'WATCH', 'HIGH');
    const c = lockKeyFor('phase_change', 'HIGH', 'PERFECT');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('WATCH→PERFECT は NEUTRAL→WATCH のロックに巻き込まれない', () => {
    expect(lockKeyFor('phase_change', 'NEUTRAL', 'WATCH')).not.toBe(
      lockKeyFor('phase_change', 'WATCH', 'PERFECT'),
    );
  });

  it('フェーズ遷移以外の鍵はそのまま', () => {
    for (const k of ['vix_spike', 'fg_panic', 'skew_high', 'perfect_now']) {
      expect(lockKeyFor(k, 'WATCH', 'PERFECT')).toBe(k);
    }
  });

  it('買い場へ上がる遷移は1時間ロック・それ以外は24時間', () => {
    expect(lockHoursFor('phase_change', 'PERFECT')).toBe(1);
    expect(lockHoursFor('phase_change', 'HIGH')).toBe(1);
    expect(lockHoursFor('phase_change', 'WATCH')).toBe(24);
    expect(lockHoursFor('phase_change', 'NEUTRAL')).toBe(24);
    expect(lockHoursFor('fg_panic', 'PERFECT')).toBe(24);
    expect(lockHoursFor('perfect_now', 'PERFECT')).toBe(24);
  });
});
