import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  const query = `You are a financial data feed. You MUST use Google Search to find the EXACT CURRENT real-time values for these specific market indicators. For indices, look at the most recent current price.
1. US 10-Year Yield (Search: "US10Y yield current price")
2. US Dollar Index (Search: "DXY current price")
3. Gold Price (Search: "Gold current price USD")
4. Silver Price (Search: "Silver current price USD")
5. VIX (Search: "INDEXCBOE: VIX")
6. SKEW (Search: "INDEXCBOE: SKEWX")
Double check the digits.`;

  const systemPrompt = "Return JSON only: {yield: number, dxy: number, gold: number, silver: number, vix: number, skew: number}. 'vix' and 'skew' should be numerical values.";

  try {
    // ---- 1. Fetch real Fear & Greed directly from CNN API ----
    let fgValue = null;
    try {
        const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            },
            // Vercel キャッシュ制御
            next: { revalidate: 60 } 
        });
        const cnnData = await cnnRes.json();
        if (cnnData && cnnData.fear_and_greed && cnnData.fear_and_greed.score !== undefined) {
            fgValue = Math.round(cnnData.fear_and_greed.score);
        }
    } catch (e) {
        console.error("CNN Fetch Error:", e);
    }

    // ---- 2. Fetch other macro data from Gemini ----
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
      const parsedData = JSON.parse(text);
      
      // 正確なF&Gの値を結合する
      if (fgValue !== null) {
          parsedData.fg = fgValue;
      } else {
          parsedData.fg = "--"; // fallback if CNN fails
      }
      
      return NextResponse.json(parsedData);
    }
    
    return NextResponse.json({ error: 'No content returned from Gemini' }, { status: 500 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
