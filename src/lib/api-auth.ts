/**
 * ルートハンドラ側の鍵チェック。
 *
 * proxy.ts だけに守りを任せない。Next.js の公式ドキュメントも
 * 「Proxy を唯一の防御線にするな。チェックはデータに近い所で行え」としており、
 * 実際に Proxy/Middleware のバイパス脆弱性が繰り返し報告されている。
 * 入口が1枚抜かれても KV と LLM の呼び出しが露出しないよう、各ルートでも突き合わせる。
 */

import { cookies } from 'next/headers';
import { MDB_COOKIE_NAME, keyMatches, sessionTokenMatches } from './auth-gate';

/** 鍵付きのリクエストか。鍵が未設定ならローカル開発だけ通す。 */
export async function isUnlocked(): Promise<boolean> {
  const secret = process.env.MARKET_DB_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const cookieKey = (await cookies()).get(MDB_COOKIE_NAME)?.value;
  return sessionTokenMatches(cookieKey, secret);
}

/** 鍵が無ければ 403 を返す。内部構造を明かさないよう本文は固定文字列だけ。 */
export function forbidden(): Response {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Vercel Cron 用の認証。CRON_SECRET が未設定なら本番では閉じる。
 * 以前は未設定時に素通しだったため、cron の URL を知る誰でも叩けた。
 */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return keyMatches(header.slice(prefix.length), cronSecret);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}
