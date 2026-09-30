import { NextResponse, type NextRequest } from 'next/server';
import {
  MDB_COOKIE_NAME,
  buildNextPath,
  keyMatches,
  mdbCookieOptions,
} from '@/lib/auth-gate';
import { renderUnlockPage } from '@/lib/unlock-page';

const PUBLIC_PATHS = [
  '/api/cron/alert',
  '/api/cron/morning-summary',
  '/api/market-data',
  '/api/unlock',
];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret = process.env.MARKET_DB_SECRET_KEY;
  if (!secret) return NextResponse.next(); // No secret configured -> fail open (dev mode)

  const cookieKey = request.cookies.get(MDB_COOKIE_NAME)?.value;
  if (cookieKey && keyMatches(cookieKey, secret)) return NextResponse.next();

  // 既存のブックマークや自動化が使う ?key= は従来どおり通す
  const queryKey = searchParams.get('key');
  if (queryKey && keyMatches(queryKey, secret)) {
    const res = NextResponse.next();
    res.cookies.set(MDB_COOKIE_NAME, secret, mdbCookieOptions);
    return res;
  }

  // API を叩いた時に HTML を返しても読めないので、そこは素の 403 のまま
  if (pathname.startsWith('/api/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return new NextResponse(
    renderUnlockPage({
      next: buildNextPath(pathname, searchParams),
      invalid: searchParams.get('unlock') === 'invalid',
    }),
    {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\.(?:jpg|jpeg|png|svg|ico|webmanifest)).*)',
  ],
};
