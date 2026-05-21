import { kv } from '@vercel/kv';

export type Profile = {
  cashPool: number;
  monthlyBudget: number;
  maxSingleAsset: number;
  maxDrawdownPct: number;
  adoptedScenario: 'worse' | 'current' | 'better';
  holdings: string;
};

const DEFAULT: Profile = {
  cashPool: 0,
  monthlyBudget: 500000,
  maxSingleAsset: 200000,
  maxDrawdownPct: 30,
  adoptedScenario: 'current',
  holdings: '',
};

const KEY = 'profile:satoru';

export async function getProfile(): Promise<Profile> {
  const stored = await kv.get<Profile>(KEY);
  return { ...DEFAULT, ...(stored ?? {}) };
}

export async function setProfile(patch: Partial<Profile>): Promise<Profile> {
  const current = await getProfile();
  const next = { ...current, ...patch };
  await kv.set(KEY, next);
  return next;
}
