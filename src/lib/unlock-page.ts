import { escapeHtml } from './auth-gate';

export type UnlockNotice = 'invalid' | 'locked';

type UnlockPageOptions = {
  /** 解錠後に戻る自サイト内のパス */
  next: string;
  /** 直前の入力に対して出す知らせ */
  notice?: UnlockNotice;
};

const NOTICE_TEXT: Record<UnlockNotice, string> = {
  invalid: '鍵が違います。もう一度入れてください。',
  locked: '入力の回数が多すぎます。10分ほど置いてからお願いします。',
};

/** クエリの値から知らせを読む。知らない値は無視する。 */
export function parseNotice(raw: string | null): UnlockNotice | undefined {
  return raw === 'invalid' || raw === 'locked' ? raw : undefined;
}

/**
 * 鍵が無い時に出す 403 の画面。
 * 「なぜ開けないのか」と「次に何をすれば開くのか」を必ず書く。
 */
export function renderUnlockPage({ next, notice }: UnlockPageOptions): string {
  const nextValue = escapeHtml(next);
  const error = notice
    ? `<p class="error" role="alert">${escapeHtml(NOTICE_TEXT[notice])}</p>`
    : '';

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>鍵を入れてください | Market Risk Pro</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #0f172a;
    color: #f8fafc;
    font-family: "Inter", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    -webkit-tap-highlight-color: transparent;
  }
  .card {
    width: 100%;
    max-width: 420px;
    padding: 28px 24px;
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  h1 { margin: 0 0 12px; font-size: 20px; font-weight: 600; letter-spacing: 0.01em; }
  p { margin: 0 0 12px; font-size: 14px; color: #cbd5e1; }
  .error {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(127, 29, 29, 0.45);
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fecaca;
  }
  form { margin-top: 20px; display: flex; flex-direction: column; gap: 12px; }
  input {
    width: 100%;
    padding: 14px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(15, 23, 42, 0.85);
    color: #f8fafc;
    font-size: 16px;
    font-family: inherit;
  }
  input:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; border-color: transparent; }
  button {
    padding: 14px 16px;
    border: 0;
    border-radius: 10px;
    background: #10b981;
    color: #04231a;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  button:hover { background: #34d399; }
  button:focus-visible { outline: 2px solid #f8fafc; outline-offset: 2px; }
  .hint { margin: 16px 0 0; font-size: 12px; color: #94a3b8; }
  code { font-size: 12px; color: #e2e8f0; }
</style>
</head>
<body>
  <main class="card">
    <h1>鍵を入れてください</h1>
    <p>Market Risk Pro は鍵で保護されています。この画面が出たのは、鍵のクッキーが切れたか別の端末で開いたからです。</p>
    <p>一度入れると、この端末では1年間そのまま開きます。</p>
    ${error}
    <form method="post" action="/api/unlock">
      <input type="hidden" name="next" value="${nextValue}">
      <input
        type="password"
        name="key"
        autocomplete="current-password"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        placeholder="鍵"
        aria-label="鍵"
        required
        autofocus
      >
      <button type="submit">開く</button>
    </form>
    <p class="hint">忘れた時は Vercel の環境変数 <code>MARKET_DB_SECRET_KEY</code> で決め直せます。</p>
  </main>
</body>
</html>`;
}
