export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: number;
  link: string;
};

const YAHOO_QUERIES = ['日経平均', 'ダウ', 'ナスダック', 'FRB'];
const REUTERS_RSS = 'https://feeds.reuters.com/reuters/businessNews';

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[!?.,;:、。!?,.;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function filterRecent24h(items: NewsItem[], nowSec: number): NewsItem[] {
  const cutoff = nowSec - 86400;
  return items.filter(i => i.publishedAt >= cutoff);
}

async function fetchYahooQuery(query: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=5&quotesCount=0`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        next: { revalidate: 0 },
      }
    );
    const data = await res.json();
    const news = data?.news ?? [];
    return news
      .filter((n: { title?: string }) => typeof n?.title === 'string')
      .map((n: { title: string; publisher?: string; providerPublishTime?: number; link?: string }) => ({
        title: n.title,
        publisher: n.publisher ?? 'Yahoo',
        publishedAt: n.providerPublishTime ?? 0,
        link: n.link ?? '',
      }));
  } catch {
    return [];
  }
}

async function fetchReutersRss(): Promise<NewsItem[]> {
  try {
    const res = await fetch(REUTERS_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 0 },
    });
    const text = await res.text();
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const block = match[1];
      const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1]?.trim() ?? '';
      const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]?.trim() ?? '';
      const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]?.trim() ?? '';
      const publishedAt = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;
      if (title) items.push({ title, publisher: 'Reuters', publishedAt, link });
      if (items.length >= 10) break;
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchAllNews(nowSec: number = Math.floor(Date.now() / 1000)): Promise<NewsItem[]> {
  const [yahooResults, reuters] = await Promise.all([
    Promise.all(YAHOO_QUERIES.map(fetchYahooQuery)),
    fetchReutersRss(),
  ]);
  const all = [...yahooResults.flat(), ...reuters];
  return dedupeNews(filterRecent24h(all, nowSec)).slice(0, 15);
}

export function formatNews(items: NewsItem[]): string {
  if (items.length === 0) return 'ニュース取得失敗（全ソース失敗）';
  return items.map((n, i) => `${i + 1}. (${n.publisher}) ${n.title}`).join('\n');
}
