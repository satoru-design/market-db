import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  const { fg, vix, skew } = await request.json();
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
