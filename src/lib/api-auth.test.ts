import { describe, it, expect, afterEach } from 'vitest';
import { isCronAuthorized } from './api-auth';

const original = {
  cron: process.env.CRON_SECRET,
  node: process.env.NODE_ENV,
};

function setEnv(key: 'CRON_SECRET' | 'NODE_ENV', value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else (process.env as Record<string, string>)[key] = value;
}

afterEach(() => {
  setEnv('CRON_SECRET', original.cron);
  setEnv('NODE_ENV', original.node);
});

function req(authorization?: string): Request {
  return new Request('https://example.test/api/cron/alert', {
    headers: authorization ? { authorization } : {},
  });
}

describe('isCronAuthorized', () => {
  it('一致する Bearer だけ通す', () => {
    setEnv('CRON_SECRET', 'cron-token');
    expect(isCronAuthorized(req('Bearer cron-token'))).toBe(true);
    expect(isCronAuthorized(req('Bearer wrong-token'))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });

  it('Bearer の形でないものを通さない', () => {
    setEnv('CRON_SECRET', 'cron-token');
    expect(isCronAuthorized(req('cron-token'))).toBe(false);
    expect(isCronAuthorized(req('Basic cron-token'))).toBe(false);
    expect(isCronAuthorized(req('bearer cron-token'))).toBe(false);
  });

  it('CRON_SECRET 未設定なら本番では閉じる（従来は素通しだった）', () => {
    setEnv('CRON_SECRET', undefined);
    setEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req())).toBe(false);
    expect(isCronAuthorized(req('Bearer anything'))).toBe(false);
  });

  it('CRON_SECRET 未設定でもローカル開発は通す', () => {
    setEnv('CRON_SECRET', undefined);
    setEnv('NODE_ENV', 'development');
    expect(isCronAuthorized(req())).toBe(true);
  });
});
