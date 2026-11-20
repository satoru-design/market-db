import { describe, it, expect } from 'vitest';
import { parseProfilePatch, MONEY_MAX } from './profile-patch';

describe('parseProfilePatch', () => {
  it('弾薬を整数の円で受け取る', () => {
    expect(parseProfilePatch({ cashPool: 390600 })).toEqual({ ok: true, patch: { cashPool: 390600 } });
  });
  it('0円は通す（弾薬を使い切った時）', () => {
    expect(parseProfilePatch({ cashPool: 0 }).ok).toBe(true);
  });
  it('負の数・小数・文字列・NaN は通さない', () => {
    for (const v of [-1, 1.5, '434000', NaN, Infinity, null]) {
      expect(parseProfilePatch({ cashPool: v }).ok).toBe(false);
    }
  });
  it('桁の打ち間違い（上限超え）は通さない', () => {
    expect(parseProfilePatch({ cashPool: MONEY_MAX + 1 }).ok).toBe(false);
  });
  it('知らない項目は通さない（KV に余計なものを書かない）', () => {
    expect(parseProfilePatch({ cashPool: 1, admin: true }).ok).toBe(false);
  });
  it('空や配列は通さない', () => {
    expect(parseProfilePatch({}).ok).toBe(false);
    expect(parseProfilePatch([]).ok).toBe(false);
    expect(parseProfilePatch(null).ok).toBe(false);
  });
  it('他の項目も型を確かめて通す', () => {
    expect(parseProfilePatch({ maxDrawdownPct: 30, adoptedScenario: 'current', holdings: 'VT 10口' }))
      .toEqual({ ok: true, patch: { maxDrawdownPct: 30, adoptedScenario: 'current', holdings: 'VT 10口' } });
    expect(parseProfilePatch({ adoptedScenario: 'best' }).ok).toBe(false);
    expect(parseProfilePatch({ maxDrawdownPct: 120 }).ok).toBe(false);
  });
});
