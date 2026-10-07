import { NextResponse } from 'next/server';
import { forbidden, isUnlocked } from '@/lib/api-auth';
import { sanityCheckIndicators } from '@/lib/indicator-sanity';

export async function POST(request: Request) {
  // proxy.ts だけに任せない。LLM の課金が走る口なので、ここでも鍵を見る
  if (!(await isUnlocked())) return forbidden();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    // 検証せずにプロンプトへ埋めると、指標の名目で任意の指示を注入できる
    const sanity = sanityCheckIndicators((body ?? {}) as Record<string, unknown>);
    if (!sanity.ok) {
      return NextResponse.json({ error: 'invalid indicators' }, { status: 400 });
    }
    const { fg, vix, skew } = sanity.indicators;

    const prompt = `F&G:${fg}, VIX:${vix}, Skew:${skew}。このデータに基づき、日本/米国株の投資家が今日取るべき戦術を150文字以内で精緻に分析して。`;

    // 鍵は URL ではなくヘッダで渡す。クエリに載せると各種ログや
    // 例外メッセージの URL ごと鍵が写る
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
