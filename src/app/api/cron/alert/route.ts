import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { detectAlerts, lockKeyFor, lockHoursFor } from '@/lib/alerts';
import { detectPhase, buySignals, type Phase } from '@/lib/signals';
import { getProfile } from '@/lib/profile';
import { buildAlertBlocks } from '@/lib/alert-blocks';

const PHASE_KEY = 'snapshot:lastPhase';
const LASTFIRED_KEY = 'alert:lastFired';

export const dynamic = 'force-dynamic';

async function sendSlack(payload: { text: string; blocks?: unknown[] }) {
  const url = process.env.MARKET_DB_SLACK_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

  // フェーズ変化時は「今何を買うか」を具体アクション付きで添える
  const profile = await getProfile();
  const capital = {
    cashPool: profile.cashPool,
    maxSingleAsset: profile.maxSingleAsset,
  };
  const signalsActive = buySignals(ind).filter(s => s.active).length;

  // ロックを通った通知だけを残す。
  const passed = alerts.filter(a => {
    const lockKey = lockKeyFor(a.key, prevPhase, currentPhase);
    const lockMs = lockHoursFor(a.key, currentPhase) * 60 * 60 * 1000;
    const last = lastFired[lockKey] ? new Date(lastFired[lockKey]).getTime() : 0;
    return now - last >= lockMs;
  });

  const markFired = (key: string) => {
    lastFired[lockKeyFor(key, prevPhase, currentPhase)] = new Date(now).toISOString();
    fired.push(key);
  };

  // 「何を買うか」を伴う通知は1通にまとめる。
  //
  // 2026-10-18 まで、PERFECT の夜は最大4通が別々に飛んでいた
  // （vix_spike / fg_panic / phase_change / perfect_now）。しかも
  // phase_change と perfect_now は本文が丸ごと同じだった。
  // 閾値は指標を見れば分かるので、畳み込んで1通にする。
  const action = passed.find(a => a.key === 'phase_change')
    ?? passed.find(a => a.key === 'perfect_now');
  const triggers = passed
    .filter(a => a.key === 'vix_spike' || a.key === 'fg_panic' || a.key === 'skew_high')
    .map(a => a.key);

  if (action) {
    const url = `${origin}/alert?event=${action.key}${secret ? `&key=${secret}` : ''}`;
    await sendSlack(buildAlertBlocks({
      phase: currentPhase,
      prevPhase,
      fg, vix, skew, signalsActive,
      capital,
      url,
      triggers,
      at: new Date(now),
    }));
    markFired(action.key);
    // 畳み込んだ閾値も「送った」扱いにする。そうしないと次の周回で
    // 同じ内容が単独で飛んでくる。
    for (const k of triggers) markFired(k);
  } else {
    // 行動を伴わない閾値だけが点いた場合。ここは短いままでよい。
    for (const a of passed) {
      const url = `${origin}/alert?event=${a.key}${secret ? `&key=${secret}` : ''}`;
      await sendSlack({ text: `${a.title}（${a.detail}） ${url}` });
      markFired(a.key);
    }
  }

  await kv.set(LASTFIRED_KEY, lastFired);
  return NextResponse.json({ phase: currentPhase, alerts: alerts.length, fired });
}
