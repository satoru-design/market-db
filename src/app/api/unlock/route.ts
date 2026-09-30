import { NextResponse, type NextRequest } from 'next/server';
import {
  MDB_COOKIE_NAME,
  keyMatches,
  mdbCookieOptions,
  safeNextPath,
} from '@/lib/auth-gate';

export const dynamic = 'force-dynamic';

/**
 * 403 画面のフォームから鍵を受け取ってクッキーを発行する。
 * 鍵を URL に載せないよう POST で受ける。
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const key = typeof form.get('key') === 'string' ? (form.get('key') as string) : '';
  const next = safeNextPath(form.get('next'));
  const secret = process.env.MARKET_DB_SECRET_KEY;

  if (!secret || !keyMatches(key, secret)) {
    const url = new URL(next, request.nextUrl.origin);
    url.searchParams.set('unlock', 'invalid');
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next, request.nextUrl.origin), 303);
  res.cookies.set(MDB_COOKIE_NAME, secret, mdbCookieOptions);
  return res;
}
