import { kv } from '@vercel/kv';

export type Profile = {
  cashPool: number;
  monthlyBudget: number;
  maxSingleAsset: number;
  maxDrawdownPct: number;
  adoptedScenario: 'worse' | 'current' | 'better';
  holdings: string;
  // 弾薬を最後に直した時刻（ISO）。古い額で通知を出していないかを画面で見るため。2026-11-21 追加。
  cashPoolUpdatedAt: string;
};

const DEFAULT: Profile = {
  cashPool: 0,
  monthlyBudget: 500000,
  maxSingleAsset: 200000,
  maxDrawdownPct: 30,
  adoptedScenario: 'current',
  holdings: '',
  cashPoolUpdatedAt: '',
};

const KEY = 'profile:satoru';

export async function getProfile(): Promise<Profile> {
  const stored = await kv.get<Profile>(KEY);
  return { ...DEFAULT, ...(stored ?? {}) };
}

export async function setProfile(patch: Partial<Profile>): Promise<Profile> {
  const current = await getProfile();
  const next = { ...current, ...patch };
  if (patch.cashPool !== undefined) next.cashPoolUpdatedAt = new Date().toISOString();
  await kv.set(KEY, next);
  return next;
}
