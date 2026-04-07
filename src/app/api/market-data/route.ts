import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let parsedData: any = {};

    // ---- 1. Fetch real Fear & Greed directly from CNN API ----
    try {
        const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://edition.cnn.com/",
                "Origin": "https://edition.cnn.com"
            },
            next: { revalidate: 60 } 
        });
        const cnnData = await cnnRes.json();
        if (cnnData?.fear_and_greed?.score !== undefined) {
            parsedData.fg = Math.round(cnnData.fear_and_greed.score);
        } else {
            parsedData.fg = "--";
        }
    } catch (e) {
        console.error("CNN Fetch Error:", e);
        parsedData.fg = "--";
    }

    // ---- 2. Fetch all other metrics from Yahoo Finance API directly ----
    try {
        const fetchYF = async (symbol: string) => {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                next: { revalidate: 60 }
            });
            const data = await res.json();
            return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? "--";
        };

        // Yahoo Finance Tickers
        parsedData.yield = await fetchYF('^TNX');
        parsedData.dxy = await fetchYF('DX-Y.NYB');
        parsedData.gold = await fetchYF('GC=F');
        parsedData.silver = await fetchYF('SI=F');
        parsedData.vix = await fetchYF('^VIX');
        parsedData.skew = await fetchYF('^SKEW');

        // 丸め処理 (UI表示でエラーにならないよう確実に数値のみ適用)
        const roundTo = (val: any, decimals: number) => typeof val === 'number' ? Number(val.toFixed(decimals)) : val;
        
        parsedData.yield = roundTo(parsedData.yield, 3);
        parsedData.dxy = roundTo(parsedData.dxy, 2);
        parsedData.gold = roundTo(parsedData.gold, 1);
        parsedData.silver = roundTo(parsedData.silver, 2);
        parsedData.vix = roundTo(parsedData.vix, 2);
        parsedData.skew = roundTo(parsedData.skew, 2);

    } catch (e) {
        console.error("Yahoo Finance Fetch Error:", e);
    }
    
    return NextResponse.json(parsedData);
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
