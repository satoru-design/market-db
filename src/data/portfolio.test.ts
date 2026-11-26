import { describe, it, expect } from 'vitest';
import { portfolioData } from './portfolio';

// 2026-11-21: 手書きの古い配分（FANG+・SOX・JEPQ・月◯万円）が今のルールと食い違っていた。
// 正本（DEPLOY・fg-stages・MONTHLY_TSUMITATE）から組み立てる形にしたので、それが保たれているかを見る。
describe('配分データは今の表と同じ中身', () => {
  const all = JSON.stringify(portfolioData);

  it('主力・守り・戻り・3倍ブル・積立・弾薬の6つ', () => {
    expect(portfolioData.map((c) => c.id)).toEqual(['main', 'def', 'rebound', 'leverage', 'tsumitate', 'pool']);
  });

  it('守りは XLP・GLDM・TLT、戻りは QQQ', () => {
    expect(all).toContain('XLP・GLDM・TLT');
    expect(portfolioData.find((c) => c.id === 'rebound')!.items.join()).toContain('QQQ');
  });

  it('古い手書きの銘柄と「月◯万円」の予算が残っていない', () => {
    for (const w of ['FANG+', 'SOX', 'JEPQ', 'BDC', '万円/月']) expect(all, w).not.toContain(w);
  });

  it('3倍ブルは PERFECT だけ金額が付く', () => {
    const lev = portfolioData.find((c) => c.id === 'leverage')!;
    expect(lev.strategy.PERFECT.budget).toBe('弾薬の30%');
    for (const ph of ['HEAT', 'HIGH', 'WATCH', 'NEUTRAL'] as const) expect(lev.strategy[ph].budget, ph).toBe('0円');
  });

  it('HIGH の主力は 弾薬の30% を段階の割合で分ける', () => {
    expect(portfolioData[0].strategy.HIGH.budget).toBe('弾薬の30%のうち 段階1 70%・段階2 60%・段階3 55%');
  });
});
