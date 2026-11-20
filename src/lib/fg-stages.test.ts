import { describe, it, expect } from 'vitest';
import { FG_STAGES, fgStage, splitByStage } from './fg-stages';

describe('F&G の3段階', () => {
  it('しきい値の境目', () => {
    expect(fgStage(31)).toBeNull();
    expect(fgStage(30)?.stage).toBe(1);
    expect(fgStage(21)?.stage).toBe(1);
    expect(fgStage(20)?.stage).toBe(2);
    expect(fgStage(11)?.stage).toBe(2);
    expect(fgStage(10)?.stage).toBe(3);
    expect(fgStage(0)?.stage).toBe(3);
    expect(fgStage(NaN)).toBeNull();
  });

  it('どの段階も割合の合計は100%で、主力が半分以上', () => {
    for (const s of FG_STAGES) {
      const sum = s.mix.main + s.mix.def + s.mix.rebound;
      expect(sum, `段階${s.stage}`).toBeCloseTo(1, 10);
      expect(s.mix.main, `段階${s.stage}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('恐怖が深いほど戻りを増やし、守りを減らす', () => {
    const [a, b, c] = FG_STAGES;
    expect(a.mix.rebound).toBeLessThan(b.mix.rebound);
    expect(b.mix.rebound).toBeLessThan(c.mix.rebound);
    expect(a.mix.def).toBeGreaterThan(b.mix.def);
    expect(b.mix.def).toBeGreaterThan(c.mix.def);
  });

  it('金額を分けても合計は元の額に一致する（端数は主力へ）', () => {
    for (const total of [43400, 130200, 1, 99999]) {
      for (const s of FG_STAGES) {
        const x = splitByStage(total, s);
        expect(x.main + x.def + x.rebound).toBe(total);
      }
    }
    expect(splitByStage(43400, null)).toEqual({ main: 43400, def: 0, rebound: 0 });
  });
});
