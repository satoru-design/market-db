/**
 * 鍵ゲートの共有定数とロジック。
 * proxy.ts と /api/unlock の両方から使う（状態は持たない純粋な関数だけ）。
 */

export const MDB_COOKIE_NAME = 'mdb_key';
export const MDB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 総当たり対策。この回数を外したら窓が開くまで受け付けない。 */
export const UNLOCK_MAX_ATTEMPTS = 10;
export const UNLOCK_WINDOW_SEC = 600;

export const mdbCookieOptions = {
  maxAge: MDB_COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: 'lax',
  secure: true,
  path: '/',
} as const;

/** 長さを先に比較したうえで、残りは定数時間で突き合わせる。 */
export function keyMatches(input: string, secret: string): boolean {
  if (!secret || typeof input !== 'string') return false;
  if (input.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= input.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

/** 解錠後の戻り先。外部サイトへ飛ばされないよう自サイト内の相対パスだけ通す。 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.charCodeAt(1) === 92) return '/'; // 92 = バックスラッシュ
  if (/[\x00-\x1f\x7f]/.test(value)) return '/';
  return value;
}

/** 鍵とエラー表示のパラメータを落として、素の戻り先を作る。 */
export function buildNextPath(pathname: string, search: URLSearchParams): string {
  const params = new URLSearchParams(search);
  params.delete('key');
  params.delete('unlock');
  const query = params.toString();
  return safeNextPath(query ? `${pathname}?${query}` : pathname);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
