import { describe, it, expect } from 'vitest';
import { sanityCheckIndicators } from './indicator-sanity';
import { detectPhase } from './signals';

describe('sanityCheckIndicators', () => {
  it('実際に有り得る値は通す', () => {
    const r = sanityCheckIndicators({ fg: 25, vix: 32.5, skew: 115 });
    expect(r).toEqual({ ok: true, indicators: { fg: 25, vix: 32.5, skew: 115 } });
  });

  it('数値でない値は弾く', () => {
    expect(sanityCheckIndicators({ fg: '--', vix: 20, skew: 120 }).ok).toBe(false);
    expect(sanityCheckIndicators({ vix: 20, skew: 120 }).ok).toBe(false);
    expect(sanityCheckIndicators({ fg: Number.NaN, vix: 20, skew: 120 }).ok).toBe(false);
  });

  it('Number() が 0 に化ける欠損値を弾く', () => {
    // Number(null) / Number('') / Number([]) はいずれも 0。
    // 素通しすると「fg=0（極度の恐怖）」として買いシグナルになる
    for (const empty of [null, undefined, '', '  ', [], {}, true, false]) {
      expect(sanityCheckIndicators({ fg: empty, vix: 30, skew: 115 }).ok).toBe(false);
    }
  });

  it('数値文字列は受ける（上流の表現揺れに耐える）', () => {
    const r = sanityCheckIndicators({ fg: '25', vix: '32.5', skew: '115' });
    expect(r).toEqual({ ok: true, indicators: { fg: 25, vix: 32.5, skew: 115 } });
  });

  it('数値だが有り得ない値を弾く（従来の NaN チェックが通していた穴）', () => {
    // SKEW は構造上 100 付近が下限。0 は上流の故障
    expect(sanityCheckIndicators({ fg: 10, vix: 30, skew: 0 }).ok).toBe(false);
    // F&G は定義上 0-100
    expect(sanityCheckIndicators({ fg: 999, vix: 30, skew: 120 }).ok).toBe(false);
    expect(sanityCheckIndicators({ fg: -5, vix: 30, skew: 120 }).ok).toBe(false);
    // VIX が 0 になることはない
    expect(sanityCheckIndicators({ fg: 10, vix: 0, skew: 120 }).ok).toBe(false);
  });

  it('壊れた値が PERFECT（全力買付）を作れないこと', () => {
    // fg<=30 / vix>=28 / skew<=118 の3つが揃うと PERFECT = cashPool 全額放出。
    // skew=0 のような上流の故障値でそれが成立してしまうのが修正前の挙動だった。
    const broken = { fg: 0, vix: 30, skew: 0 };
    expect(detectPhase(broken)).toBe('PERFECT');
    expect(sanityCheckIndicators(broken).ok).toBe(false);
  });

  it('外れた指標の名前を理由に含める', () => {
    const r = sanityCheckIndicators({ fg: 10, vix: 30, skew: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('skew');
  });
});
