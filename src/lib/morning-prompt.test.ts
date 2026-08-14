import { describe, it, expect } from 'vitest';
import { buildMorningPrompt } from './morning-prompt';

describe('buildMorningPrompt', () => {
  it('全要素を含む完全プロンプトを生成', () => {
    const out = buildMorningPrompt({
      indicatorsBlock: '日経 38,920 (-1.2%)',
      extrasBlock: 'F&G 60 / VIX 18',
      newsBlock: '1. (Reuters) Test headline',
      holdings: 'SPXL 50株',
    });
    expect(out).toContain('日経 38,920 (-1.2%)');
    expect(out).toContain('F&G 60 / VIX 18');
    expect(out).toContain('1. (Reuters) Test headline');
    expect(out).toContain('SPXL 50株');
    expect(out).toContain('300文字以内');
    expect(out).toContain('📊 振り返り');
    expect(out).toContain('🔮 今日');
    expect(out).toContain('💡 持ち株');
    expect(out).toContain('Slack mrkdwn');
    expect(out).toContain('銘柄ごとに1行');
    expect(out).toContain('バッククォートで囲む');
    expect(out).toContain('継続積立方針');
    expect(out).toContain('積立◎');
  });

  it('holdings 空文字でも壊れず、一般配分提案を促す文言を含む', () => {
    const out = buildMorningPrompt({
      indicatorsBlock: '日経 38,920',
      extrasBlock: 'F&G 60',
      newsBlock: '1. (Reuters) Test',
      holdings: '',
    });
    expect(out).toContain('持ち株情報なし');
    expect(out).toContain('一般的な配分提案');
  });
});
