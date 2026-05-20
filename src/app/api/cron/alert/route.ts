import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { detectAlerts } from '@/lib/alerts';
import { detectPhase, type Phase } from '@/lib/signals';

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
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
  // For now we accept the request if either: (a) no CRON_SECRET configured, or (b) header matches.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const md = await fetch(`${origin}/api/market-data`).then(r => r.json());

  const fg = Number(md.fg);
  const vix = Number(md.vix);
  const skew = Number(md.skew);
  if (Number.isNaN(fg) || Number.isNaN(vix) || Number.isNaN(skew)) {
    return NextResponse.json({ skipped: 'no indicators' });
  }

  const ind = { fg, vix, skew };
  const prevPhase = await kv.get<Phase>(PHASE_KEY);
  const alerts = detectAlerts(ind, prevPhase);
  const currentPhase = detectPhase(ind);
  await kv.set(PHASE_KEY, currentPhase);

  const lastFired = (await kv.get<Record<string, string>>(LASTFIRED_KEY)) ?? {};
  const now = Date.now();
  const fired: string[] = [];
  const secret = process.env.MARKET_DB_SECRET_KEY ?? '';

  for (const a of alerts) {
    const last = lastFired[a.key] ? new Date(lastFired[a.key]).getTime() : 0;
    if (now - last < ALERT_LOCK_HOURS * 60 * 60 * 1000) continue;
    const url = `${origin}/alert?event=${a.key}${secret ? `&key=${secret}` : ''}`;
    await sendSlack(`🚨 ${a.title}\n${a.detail}\n📊 ${url}`);
    lastFired[a.key] = new Date(now).toISOString();
    fired.push(a.key);
  }

  await kv.set(LASTFIRED_KEY, lastFired);
  return NextResponse.json({ phase: currentPhase, alerts: alerts.length, fired });
}
