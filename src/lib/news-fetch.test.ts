import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  dedupeNews,
  filterRecent24h,
  formatNews,
  type NewsItem,
} from './news-fetch';

describe('normalizeTitle', () => {
  it('lowercase + 記号除去', () => {
    expect(normalizeTitle('FED, Hikes Rates!')).toBe('fed hikes rates');
  });
  it('日本語の句読点も除去', () => {
    expect(normalizeTitle('日経、続伸。')).toBe('日経続伸');
  });
});

describe('dedupeNews', () => {
  it('同タイトル正規化が重複したら最初の1件のみ', () => {
    const items: NewsItem[] = [
      { title: 'FED Hikes Rates', publisher: 'Reuters', publishedAt: 1, link: 'a' },
      { title: 'fed, hikes, rates!', publisher: 'Yahoo', publishedAt: 2, link: 'b' },
      { title: 'NVDA earnings beat', publisher: 'CNBC', publishedAt: 3, link: 'c' },
    ];
    expect(dedupeNews(items)).toHaveLength(2);
    expect(dedupeNews(items)[0].link).toBe('a');
  });
});

describe('filterRecent24h', () => {
  it('24h以内は残り、超過は除外', () => {
    const now = 1_700_000_000;
    const items: NewsItem[] = [
      { title: 'a', publisher: 'x', publishedAt: now - 3600, link: 'a' },
      { title: 'b', publisher: 'x', publishedAt: now - 86400 * 2, link: 'b' },
    ];
    expect(filterRecent24h(items, now)).toHaveLength(1);
    expect(filterRecent24h(items, now)[0].title).toBe('a');
  });
});

describe('formatNews', () => {
  it('番号付きで publisher と title を 1行ずつ', () => {
    const items: NewsItem[] = [
      { title: 'First headline', publisher: 'Reuters', publishedAt: 1, link: 'a' },
      { title: 'Second headline', publisher: 'Yahoo!Japan', publishedAt: 2, link: 'b' },
    ];
    const out = formatNews(items);
    expect(out).toContain('1. (Reuters) First headline');
    expect(out).toContain('2. (Yahoo!Japan) Second headline');
  });
  it('空配列ならニュース取得失敗メッセージ', () => {
    expect(formatNews([])).toBe('ニュース取得失敗（全ソース失敗）');
  });
});
