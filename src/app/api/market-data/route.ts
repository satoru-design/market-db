import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  // Geminiには、VIXとSKEWの検索をさせないようにする
  const query = `You are a financial data feed. You MUST use Google Search to find the EXACT CURRENT real-time values for these specific market indicators. For indices, look at the most recent current price.
1. US 10-Year Yield (Search: "US10Y yield current price")
2. US Dollar Index (Search: "DXY current price")
3. Gold Price (Search: "Gold current price USD")
4. Silver Price (Search: "Silver current price USD")
Double check the digits.`;

  const systemPrompt = "Return JSON only: {yield: number, dxy: number, gold: number, silver: number}. All values should be numerical.";

  try {
    // ---- 1. Fetch real Fear & Greed directly from CNN API ----
    let fgValue = null;
    try {
        const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json"
            },
            next: { revalidate: 60 } 
        });
        const cnnData = await cnnRes.json();
        if (cnnData?.fear_and_greed?.score !== undefined) {
            fgValue = Math.round(cnnData.fear_and_greed.score);
        }
    } catch (e) {
        console.error("CNN Fetch Error:", e);
    }

    // ---- 2. Fetch VIX and SKEW directly from Yahoo Finance API ----
    let vixValue = null;
    let skewValue = null;
    try {
        const fetchYF = async (symbol: string) => {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                next: { revalidate: 60 }
            });
            const data = await res.json();
            return data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        };

        vixValue = await fetchYF('^VIX');
        skewValue = await fetchYF('^SKEW');
    } catch (e) {
        console.error("Yahoo Finance Fetch Error:", e);
    }

    // ---- 3. Fetch other macro data from Gemini ----
    let parsedData: any = {};
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: query }] }],
            tools: [{ google_search: {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
        })
        });
        
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            parsedData = JSON.parse(text);
        }
    } catch (e) {
        console.error("Gemini Fetch Error:", e);
    }
    
    // 正確な値を結合する
    parsedData.fg = fgValue !== null ? fgValue : "--";
    parsedData.vix = vixValue !== null ? vixValue : "--";
    parsedData.skew = skewValue !== null ? skewValue : "--";
    
    return NextResponse.json(parsedData);
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
