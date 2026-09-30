import { kv } from '@vercel/kv';
import { NextResponse, type NextRequest } from 'next/server';
import {
  MDB_COOKIE_NAME,
  UNLOCK_MAX_ATTEMPTS,
  UNLOCK_WINDOW_SEC,
  keyMatches,
  mdbCookieOptions,
  safeNextPath,
} from '@/lib/auth-gate';

export const dynamic = 'force-dynamic';

/** Vercel が付ける値を先に見る。客が名乗った x-forwarded-for は最後の手段。 */
function clientIp(request: NextRequest): string {
  const trusted =
    request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip');
  if (trusted) return trusted.split(',')[0].trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function failKey(ip: string): string {
  return `unlock:fail:${ip}`;
}

/** KV が落ちている時に自分が締め出されないよう、数えられない時は通す。 */
async function failedAttempts(ip: string): Promise<number> {
  try {
    return (await kv.get<number>(failKey(ip))) ?? 0;
  } catch {
    // 数えられない時は素通し
    return 0;
  }
}

async function recordFailure(ip: string): Promise<void> {
  try {
    const count = await kv.incr(failKey(ip));
    if (count === 1) await kv.expire(failKey(ip), UNLOCK_WINDOW_SEC);
  } catch {
    // 記録できなくても解錠の判定は続ける
  }
}

async function clearFailures(ip: string): Promise<void> {
  try {
    await kv.del(failKey(ip));
  } catch {
    // 消せなくても窓が閉じれば消える
  }
}

/**
 * 403 画面のフォームから鍵を受け取ってクッキーを発行する。
 * 鍵を URL に載せないよう POST で受ける。
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const raw = form.get('key');
  const key = typeof raw === 'string' ? raw.trim() : '';
  const next = safeNextPath(form.get('next'));
  const secret = process.env.MARKET_DB_SECRET_KEY;
  const ip = clientIp(request);

  const backTo = (notice?: 'invalid' | 'locked') => {
    const url = new URL(next, request.nextUrl.origin);
    if (notice) url.searchParams.set('unlock', notice);
    return url;
  };

  if ((await failedAttempts(ip)) >= UNLOCK_MAX_ATTEMPTS) {
    return NextResponse.redirect(backTo('locked'), 303);
  }

  if (!secret || !keyMatches(key, secret)) {
    await recordFailure(ip);
    return NextResponse.redirect(backTo('invalid'), 303);
  }

  await clearFailures(ip);
  const res = NextResponse.redirect(backTo(), 303);
  res.cookies.set(MDB_COOKIE_NAME, secret, mdbCookieOptions);
  return res;
}
