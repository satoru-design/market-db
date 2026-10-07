import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { detectAlerts } from '@/lib/alerts';
import { detectPhase, buySignals, type Phase } from '@/lib/signals';
import { getProfile } from '@/lib/profile';
import { formatBuyAction } from '@/lib/buy-action';
import { isCronAuthorized, unauthorized } from '@/lib/api-auth';
import { sanityCheckIndicators } from '@/lib/indicator-sanity';

const ALERT_LOCK_HOURS = 24;
const PHASE_KEY = 'snapshot:lastPhase';
const LASTFIRED_KEY = 'alert:lastFired';

export const dynamic = 'force-dynamic';

async function sendSlack(text: string) {
  const url = process.env.MARKET_DB_SLACK_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function GET(request: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  // CRON_SECRET が未設定でも通していたため、URL を知る誰でも叩けて
  // Slack への通知と KV のフェーズ記録を外部から動かせた。本番では必ず要求する。
  if (!isCronAuthorized(request)) return unauthorized();

  const origin = new URL(request.url).origin;
  const md = await fetch(`${origin}/api/market-data`).then(r => r.json());

  // 上流が壊れた値を返した時に買い推奨を出さない。NaN だけでなく範囲も見る
  const sanity = sanityCheckIndicators(md);
  if (!sanity.ok) {
    console.error('alert: indicator sanity check failed:', sanity.reason);
    return NextResponse.json({ skipped: 'indicators out of range' });
  }

  const ind = sanity.indicators;
  const { fg, vix, skew } = ind;
  const prevPhase = await kv.get<Phase>(PHASE_KEY);
  const alerts = detectAlerts(ind, prevPhase);
  const currentPhase = detectPhase(ind);
  await kv.set(PHASE_KEY, currentPhase);

  const lastFired = (await kv.get<Record<string, string>>(LASTFIRED_KEY)) ?? {};
  const now = Date.now();
  const fired: string[] = [];

  // フェーズ変化時は「今何を買うか」を具体アクション付きで添える
  const profile = await getProfile();
  const capital = {
    cashPool: profile.cashPool,
    maxSingleAsset: profile.maxSingleAsset,
  };
  const signalsActive = buySignals(ind).filter(s => s.active).length;

  for (const a of alerts) {
    const last = lastFired[a.key] ? new Date(lastFired[a.key]).getTime() : 0;
    if (now - last < ALERT_LOCK_HOURS * 60 * 60 * 1000) continue;
    // 解錠は POST /api/unlock だけ（0c319d7）。通知リンクに認証情報は載せない。
    const url = `${origin}/alert?event=${encodeURIComponent(a.key)}`;
    let text = `🚨 ${a.title}\n${a.detail}\n📊 ${url}`;
    if (a.key === 'phase_change') {
      text += `\n\n${formatBuyAction(currentPhase, capital, { fg, vix, skew, signalsActive })}`;
    }
    await sendSlack(text);
    lastFired[a.key] = new Date(now).toISOString();
    fired.push(a.key);
  }

  await kv.set(LASTFIRED_KEY, lastFired);
  return NextResponse.json({ phase: currentPhase, alerts: alerts.length, fired });
}
