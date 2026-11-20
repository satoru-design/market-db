import { NextResponse } from 'next/server';
import { PLAN_TICKERS } from '@/lib/share-plan';

// 株数の計算に使う株価（ドル）とドル円。2026-11-21 追加。
// 取れなかった銘柄は null で返す（画面はその銘柄を0株にして投信に回す）。

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const [fx, ...rows] = await Promise.all([lastPrice('JPY=X'), ...PLAN_TICKERS.map(lastPrice)]);
  const prices: Record<string, number | null> = {};
  let latest = 0;
  PLAN_TICKERS.forEach((t, i) => {
    prices[t] = rows[i].price;
    if (rows[i].time && rows[i].time! > latest) latest = rows[i].time!;
  });
  return NextResponse.json({
    usdjpy: fx.price,
    prices,
    asOf: latest ? new Date(latest * 1000).toISOString() : null,
  });
}
