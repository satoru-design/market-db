import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/api/cron/alert']; // Cron uses its own auth

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret = process.env.MARKET_DB_SECRET_KEY;
  if (!secret) return NextResponse.next(); // No secret configured -> fail open (dev mode)

  const cookieKey = request.cookies.get('mdb_key')?.value;
  if (cookieKey === secret) return NextResponse.next();

  const queryKey = searchParams.get('key');
  if (queryKey === secret) {
    const res = NextResponse.next();
    res.cookies.set('mdb_key', secret, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
    return res;
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.(?:jpg|jpeg|png|svg|ico|webmanifest)).*)',
  ],
};
