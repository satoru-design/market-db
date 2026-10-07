import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchSnapshot, formatSnapshot } from '@/lib/market-snapshot';
import { fetchAllNews, formatNews } from '@/lib/news-fetch';
import { buildMorningPrompt } from '@/lib/morning-prompt';
import { getProfile } from '@/lib/profile';
import { detectPhase, buySignals } from '@/lib/signals';
import { formatBuyAction } from '@/lib/buy-action';
import { isCronAuthorized, unauthorized } from '@/lib/api-auth';
import { sanityCheckIndicators } from '@/lib/indicator-sanity';

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
  // CRON_SECRET が未設定でも通していたため、URL を知る誰でも叩けた。
  // 1回ごとに Anthropic の課金と Slack 投稿が走るので本番では必ず要求する。
  if (!isCronAuthorized(request)) return unauthorized();

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

    // 「今何を買うか」を毎朝そのまま実行できる形（ティッカー・金額・買い方）で添える。
    // 上流が壊れた値を返した時は金額を出さない（NaN だけでなく範囲も見る）
    const sanity = sanityCheckIndicators(md);
    let buyBlock = '';
    if (sanity.ok) {
      const ind = sanity.indicators;
      buyBlock =
        '\n\n' +
        formatBuyAction(
          detectPhase(ind),
          {
            cashPool: profile.cashPool,
            maxSingleAsset: profile.maxSingleAsset,
          },
          { ...ind, signalsActive: buySignals(ind).filter(s => s.active).length },
        );
    } else {
      console.error('morning-summary: indicator sanity check failed:', sanity.reason);
      buyBlock = '\n\n⚠️ 指標が取得できなかったため「今どう動くか」は省略。手元で確認のうえ判断すること';
    }

    const slackText = `🌅 *${dateLabel} Morning Briefing*\n\n${body}${buyBlock}\n\n📈 <${origin}/|Daily Briefing>`;
    await sendSlack(slackText);

    return NextResponse.json({ ok: true, dateLabel, bodyLength: body.length, newsCount: news.length });
  } catch (err) {
    // 例外の本文には上流 API のエラー本体や内部 URL が混じる。
    // Slack とレスポンスには出さず、詳細はサーバーログだけに残す。
    const message = err instanceof Error ? err.message : String(err);
    console.error('morning-summary failed:', message);
    await sendSlack(`⚠️ Morning Briefing 生成失敗 (${dateLabel})。詳細はサーバーログを確認`);
    return NextResponse.json({ ok: false, error: 'generation failed' }, { status: 500 });
  }
}
