import { describe, it, expect } from 'vitest';
import { HOLDINGS_MAX_LENGTH, validateProfilePatch } from './profile-validate';

function errorsOf(input: unknown): string[] {
  const r = validateProfilePatch(input);
  return r.ok ? [] : r.errors;
}

describe('validateProfilePatch', () => {
  it('正当な値は通す', () => {
    const r = validateProfilePatch({ cashPool: 500000, adoptedScenario: 'worse' });
    expect(r).toEqual({ ok: true, patch: { cashPool: 500000, adoptedScenario: 'worse' } });
  });

  it('金額の上限を超える値を弾く（通知の投入額がここで決まる）', () => {
    expect(errorsOf({ cashPool: 1_000_000_000 })).toHaveLength(1);
    expect(errorsOf({ maxSingleAsset: 99_999_999 })).toHaveLength(1);
  });

  it('負値・非数値・NaN を弾く', () => {
    expect(errorsOf({ cashPool: -1 })).toHaveLength(1);
    expect(errorsOf({ cashPool: '500000' })).toHaveLength(1);
    expect(errorsOf({ cashPool: Number.NaN })).toHaveLength(1);
    expect(errorsOf({ cashPool: Number.POSITIVE_INFINITY })).toHaveLength(1);
  });

  it('maxDrawdownPct は 0-100 だけ', () => {
    expect(validateProfilePatch({ maxDrawdownPct: 30 }).ok).toBe(true);
    expect(errorsOf({ maxDrawdownPct: 101 })).toHaveLength(1);
  });

  it('adoptedScenario は既知の3値だけ', () => {
    expect(validateProfilePatch({ adoptedScenario: 'current' }).ok).toBe(true);
    expect(errorsOf({ adoptedScenario: 'moon' })).toHaveLength(1);
  });

  it('知らないキーを保存しない', () => {
    expect(errorsOf({ cashPool: 1000, isAdmin: true })).toHaveLength(1);
    expect(errorsOf({ __proto__: { polluted: true } })).toEqual(['更新する項目が無い']);
  });

  it('holdings は文字列かつ長さ制限つき（LLM プロンプトに入る）', () => {
    expect(validateProfilePatch({ holdings: 'VT 10株' }).ok).toBe(true);
    expect(errorsOf({ holdings: 123 })).toHaveLength(1);
    expect(errorsOf({ holdings: 'a'.repeat(HOLDINGS_MAX_LENGTH + 1) })).toHaveLength(1);
  });

  it('オブジェクト以外と空の更新を弾く', () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf('cashPool=1')).toHaveLength(1);
    expect(errorsOf([{ cashPool: 1 }])).toHaveLength(1);
    expect(errorsOf({})).toEqual(['更新する項目が無い']);
  });
});
