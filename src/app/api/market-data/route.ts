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
5. CNN Fear and Greed Index (Search: 'CNN fear and greed current index today' and output the EXACT current score 0-100)
6. VIX (Search: "INDEXCBOE: VIX")
7. SKEW (Search: "INDEXCBOE: SKEWX")
Double check the digits.`;

  const systemPrompt = "Return JSON only: {yield: number, dxy: number, gold: number, silver: number, fg: number, vix: number, skew: number}. 'fg' should be an integer score (0-100). 'vix' and 'skew' should be numerical values.";

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
      return NextResponse.json(JSON.parse(text));
    }
    
    return NextResponse.json({ error: 'No content returned from Gemini' }, { status: 500 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
