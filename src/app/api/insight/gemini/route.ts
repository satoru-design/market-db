import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { fg, vix, skew } = body;
    
    const prompt = `F&G:${fg}, VIX:${vix}, Skew:${skew}。このデータに基づき、日本/米国株の投資家が今日取るべき戦術を150文字以内で精緻に分析して。`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return NextResponse.json({ insight: text || '分析データの取得に失敗しました。' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
