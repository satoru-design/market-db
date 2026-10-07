import { describe, it, expect } from 'vitest';
import {
  buildNextPath,
  escapeHtml,
  keyMatches,
  safeNextPath,
  sessionToken,
  sessionTokenMatches,
} from './auth-gate';
import { parseNotice, renderUnlockPage } from './unlock-page';

describe('keyMatches', () => {
  it('完全一致だけ通す', () => {
    expect(keyMatches('abc123', 'abc123')).toBe(true);
    expect(keyMatches('abc124', 'abc123')).toBe(false);
  });

  it('長さ違い・空・secret 未設定は通さない', () => {
    expect(keyMatches('abc12', 'abc123')).toBe(false);
    expect(keyMatches('', 'abc123')).toBe(false);
    expect(keyMatches('abc123', '')).toBe(false);
  });
});

describe('sessionToken', () => {
  it('クッキーに鍵そのものを置かない', () => {
    const secret = 'super-secret-key';
    const token = sessionToken(secret);
    expect(token).not.toContain(secret);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('鍵が変われば値も変わる', () => {
    expect(sessionToken('a-key')).not.toBe(sessionToken('b-key'));
  });

  it('同じ鍵なら同じ値（端末をまたいで使える）', () => {
    expect(sessionToken('a-key')).toBe(sessionToken('a-key'));
  });
});

describe('sessionTokenMatches', () => {
  it('今の鍵から導いた値だけ通す', () => {
    expect(sessionTokenMatches(sessionToken('a-key'), 'a-key')).toBe(true);
    expect(sessionTokenMatches(sessionToken('a-key'), 'b-key')).toBe(false);
  });

  it('鍵の生値をクッキーに入れても通らない', () => {
    expect(sessionTokenMatches('a-key', 'a-key')).toBe(false);
  });

  it('欠落・空・secret 未設定は通さない', () => {
    expect(sessionTokenMatches(undefined, 'a-key')).toBe(false);
    expect(sessionTokenMatches('', 'a-key')).toBe(false);
    expect(sessionTokenMatches(sessionToken('a-key'), '')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('自サイト内の相対パスは通す', () => {
    expect(safeNextPath('/glance')).toBe('/glance');
    expect(safeNextPath('/alert?tab=1')).toBe('/alert?tab=1');
  });

  it('外部へ飛ばす形は / に落とす', () => {
    expect(safeNextPath('//evil.example.com')).toBe('/');
    expect(safeNextPath(String.fromCharCode(47, 92) + 'evil.example.com')).toBe('/');
    expect(safeNextPath('https://evil.example.com')).toBe('/');
    expect(safeNextPath('/ok\nSet-Cookie: x=1')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });
});

describe('buildNextPath', () => {
  it('key と unlock を落とす', () => {
    const params = new URLSearchParams('key=secret&unlock=invalid&tab=2');
    expect(buildNextPath('/glance', params)).toBe('/glance?tab=2');
  });

  it('残りが無ければパスだけ返す', () => {
    expect(buildNextPath('/', new URLSearchParams('key=secret'))).toBe('/');
  });
});

describe('escapeHtml', () => {
  it('属性を抜けられる文字を潰す', () => {
    expect(escapeHtml('"><script>')).toBe('&quot;&gt;&lt;script&gt;');
  });
});

describe('renderUnlockPage', () => {
  it('鍵を POST するフォームを出す', () => {
    const html = renderUnlockPage({ next: '/glance' });
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/unlock"');
    expect(html).toContain('value="/glance"');
    expect(html).not.toContain('role="alert"');
  });

  it('間違えた時だけエラーを出す', () => {
    const html = renderUnlockPage({ next: '/', notice: 'invalid' });
    expect(html).toContain('鍵が違います');
  });

  it('回数超過は待つよう伝える', () => {
    const html = renderUnlockPage({ next: '/', notice: 'locked' });
    expect(html).toContain('回数が多すぎます');
  });

  it('next に仕込まれた HTML を埋め込まない', () => {
    const html = renderUnlockPage({ next: '/"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('parseNotice', () => {
  it('知っている値だけ通す', () => {
    expect(parseNotice('invalid')).toBe('invalid');
    expect(parseNotice('locked')).toBe('locked');
  });

  it('知らない値と欠落は無視する', () => {
    expect(parseNotice('<script>')).toBeUndefined();
    expect(parseNotice(null)).toBeUndefined();
  });
});
