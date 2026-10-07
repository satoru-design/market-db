import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { forbidden, isUnlocked } from '@/lib/api-auth';
import { sanityCheckIndicators } from '@/lib/indicator-sanity';

export async function POST(request: Request) {
  // proxy.ts だけに任せない。LLM の課金が走る口なので、ここでも鍵を見る
  if (!(await isUnlocked())) return forbidden();

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

  const prompt = `あなたは投資戦略アナリストです。F&G:${fg}, VIX:${vix}, Skew:${skew}。このデータに基づき、日本/米国株の投資家が今日取るべき戦術を150文字以内で精緻に分析してください。`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');

  return NextResponse.json({ insight: text || 'Claude分析の取得に失敗しました。' });
}
