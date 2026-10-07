/**
 * /api/profile PATCH のサーバーサイド検証。
 *
 * ここの値は Slack 通知の投入金額をそのまま決める（buy-action.ts が
 * cashPool にフェーズ別の比率を掛けて「今回投入」を出す）。
 * 従来は受け取った JSON を無検証で KV にマージしていたため、
 * 知らないキーの混入・負値・文字列・巨大値がそのまま保存できた。
 *
 * 既知のキーだけを通し、それぞれに型と上限を課す。
 * 上限は「1回の通知が推奨しうる最大額」の歯止めであり、
 * これが無いと通知が事実上無制限の買付を指示できる。
 */

import type { Profile } from './profile';

/** 円建ての上限。実際の運用規模（積立 月10万円）から見て十分に余裕のある外枠。 */
export const PROFILE_LIMITS = {
  cashPool: { min: 0, max: 100_000_000 },
  monthlyBudget: { min: 0, max: 10_000_000 },
  maxSingleAsset: { min: 0, max: 10_000_000 },
  maxDrawdownPct: { min: 0, max: 100 },
} as const;

/** holdings はそのまま LLM プロンプトに入るので長さを縛る。 */
export const HOLDINGS_MAX_LENGTH = 4000;

const SCENARIOS: Profile['adoptedScenario'][] = ['worse', 'current', 'better'];

export type ValidationResult =
  | { ok: true; patch: Partial<Profile> }
  | { ok: false; errors: string[] };

function validateYen(
  key: keyof typeof PROFILE_LIMITS,
  value: unknown,
  errors: string[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${key} は有限の数値でなければならない`);
    return undefined;
  }
  const { min, max } = PROFILE_LIMITS[key];
  if (value < min || value > max) {
    errors.push(`${key} は ${min}-${max} の範囲でなければならない`);
    return undefined;
  }
  return Math.round(value);
}

/**
 * 既知のキーだけを取り出して検証する。
 * 知らないキーは黙って捨てず、エラーとして返す（書いたつもりが入らない事故を防ぐ）。
 */
export function validateProfilePatch(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['本文は JSON オブジェクトでなければならない'] };
  }

  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const patch: Partial<Profile> = {};

  const known = new Set([...Object.keys(PROFILE_LIMITS), 'adoptedScenario', 'holdings']);
  for (const key of Object.keys(body)) {
    if (!known.has(key)) errors.push(`${key} は受け付けないキー`);
  }

  for (const key of Object.keys(PROFILE_LIMITS) as (keyof typeof PROFILE_LIMITS)[]) {
    if (!(key in body)) continue;
    const value = validateYen(key, body[key], errors);
    if (value !== undefined) patch[key] = value;
  }

  if ('adoptedScenario' in body) {
    const value = body.adoptedScenario;
    if (typeof value !== 'string' || !SCENARIOS.includes(value as Profile['adoptedScenario'])) {
      errors.push(`adoptedScenario は ${SCENARIOS.join(' / ')} のいずれか`);
    } else {
      patch.adoptedScenario = value as Profile['adoptedScenario'];
    }
  }

  if ('holdings' in body) {
    const value = body.holdings;
    if (typeof value !== 'string') {
      errors.push('holdings は文字列でなければならない');
    } else if (value.length > HOLDINGS_MAX_LENGTH) {
      errors.push(`holdings は ${HOLDINGS_MAX_LENGTH} 文字以内`);
    } else {
      patch.holdings = value;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: ['更新する項目が無い'] };
  }
  return { ok: true, patch };
}
