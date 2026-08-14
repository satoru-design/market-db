import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchSnapshot, formatSnapshot } from '@/lib/market-snapshot';
import { fetchAllNews, formatNews } from '@/lib/news-fetch';
import { buildMorningPrompt } from '@/lib/morning-prompt';
import { getProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function jstDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

async function sendSlack(text: string): Promise<void> {
  const url = process.env.MARKET_DB_SLACK_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const dateLabel = jstDateString();

  try {
    const [snap, news, marketDataRes, profile] = await Promise.all([
      fetchSnapshot(),
      fetchAllNews(),
      fetch(`${origin}/api/market-data`).then(r => r.json()).catch(() => ({})),
      getProfile(),
    ]);

    const md = marketDataRes as { fg?: number | string; vix?: number; skew?: number; yield?: number };
    const extrasBlock = `F&G ${md.fg ?? '--'} / VIX ${md.vix ?? '--'} / Skew ${md.skew ?? '--'} / US10Y ${md.yield ?? '--'}%`;

    const prompt = buildMorningPrompt({
      indicatorsBlock: formatSnapshot(snap),
      extrasBlock,
      newsBlock: formatNews(news),
      holdings: profile.holdings,
    });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const body = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('');

    const slackText = `🌅 *${dateLabel} Morning Briefing*\n\n${body}\n\n📈 <${origin}/|Daily Briefing>`;
    await sendSlack(slackText);

    return NextResponse.json({ ok: true, dateLabel, bodyLength: body.length, newsCount: news.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendSlack(`⚠️ Morning Briefing 生成失敗 (${dateLabel}): ${message.slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
