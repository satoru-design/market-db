import { PLAN_TICKERS } from './share-plan';

// 株数の計算に使う株価（ドル）とドル円を Yahoo から取る。
// 画面（/api/quotes）と Slack の通知（cron）が同じ値を使うよう、ここに1つだけ置く。
// 取れなかった銘柄は null（その銘柄は0株にして、その分は弾薬に残る）。2026-11-21 追加。

export type Quotes = { usdjpy: number | null; prices: Record<string, number | null>; asOf: string | null };

async function lastPrice(symbol: string): Promise<{ price: number | null; time: number | null }> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { price: null, time: null };
    const meta = (await res.json())?.chart?.result?.[0]?.meta;
    const price = typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    const time = typeof meta?.regularMarketTime === 'number' ? meta.regularMarketTime : null;
    return { price, time };
  } catch {
    return { price: null, time: null };
  }
}

export async function fetchQuotes(): Promise<Quotes> {
  const [fx, ...rows] = await Promise.all([lastPrice('JPY=X'), ...PLAN_TICKERS.map(lastPrice)]);
  const prices: Record<string, number | null> = {};
  let latest = 0;
  PLAN_TICKERS.forEach((t, i) => {
    prices[t] = rows[i].price;
    const time = rows[i].time;
    if (time && time > latest) latest = time;
  });
  return { usdjpy: fx.price, prices, asOf: latest ? new Date(latest * 1000).toISOString() : null };
}

/** ドルの株価を円にする。ドル円が無ければ null（株数は出せない）。 */
export function pricesInYen(q: Quotes | null): Record<string, number | null> | null {
  if (!q?.usdjpy) return null;
  const out: Record<string, number | null> = {};
  for (const [t, p] of Object.entries(q.prices)) out[t] = p === null ? null : p * q.usdjpy;
  return out;
}
