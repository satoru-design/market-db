import type { Profile } from './profile';

// /api/profile の PATCH に来た中身を、保存してよい形か確かめる。
// 弾薬（cashPool）は Slack の通知で買う額の元になるので、文字列や負の数を通さない。
// 2026-11-21 追加。以前は検証なしで KV に書いていた。

const MONEY_KEYS = ['cashPool', 'monthlyBudget', 'maxSingleAsset'] as const;
const SCENARIOS: Profile['adoptedScenario'][] = ['worse', 'current', 'better'];

// 弾薬の上限。桁を打ち間違えた時に止めるためのもの（10億円）。
export const MONEY_MAX = 1_000_000_000;

export type PatchResult =
  | { ok: true; patch: Partial<Profile> }
  | { ok: false; error: string };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseProfilePatch(body: unknown): PatchResult {
  if (!isPlainObject(body)) return { ok: false, error: '中身が読めませんでした' };
  const patch: Partial<Profile> = {};

  for (const [key, value] of Object.entries(body)) {
    if ((MONEY_KEYS as readonly string[]).includes(key)) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MONEY_MAX) {
        return { ok: false, error: `${key} は0以上の整数（円）で入れてください` };
      }
      patch[key as (typeof MONEY_KEYS)[number]] = value;
    } else if (key === 'maxDrawdownPct') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        return { ok: false, error: 'maxDrawdownPct は0〜100で入れてください' };
      }
      patch.maxDrawdownPct = value;
    } else if (key === 'adoptedScenario') {
      if (!SCENARIOS.includes(value as Profile['adoptedScenario'])) {
        return { ok: false, error: 'adoptedScenario の値が違います' };
      }
      patch.adoptedScenario = value as Profile['adoptedScenario'];
    } else if (key === 'holdings') {
      if (typeof value !== 'string' || value.length > 10_000) {
        return { ok: false, error: 'holdings は1万字までの文字で入れてください' };
      }
      patch.holdings = value;
    } else {
      return { ok: false, error: `知らない項目です: ${key}` };
    }
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: '変える項目がありません' };
  return { ok: true, patch };
}
