/**
 * 指標の異常値検知。
 *
 * fg / vix / skew は CNN と Yahoo Finance の非公式 JSON から取っている。
 * 上流が壊れた値（0 や欠損の代わりの数値）を返すと detectPhase がそれを
 * そのまま信じ、Slack に「PERFECT＝全力買付・成行一括」まで出してしまう。
 * 従来のチェックは NaN だけで、0 のような「数値ではあるが有り得ない値」を通していた。
 *
 * 各指標が定義上・歴史上あり得る範囲に収まっているかを見て、
 * 外れていたら判断材料として使わない（通知を出さない）。
 */

import type { Indicators } from './signals';

/** 下限・上限とも含む。歴史的な最大値に余裕を持たせた外枠。 */
export const INDICATOR_RANGES = {
  // CNN Fear & Greed は定義上 0-100
  fg: { min: 0, max: 100 },
  // VIX の史上最高は 2008 年の 89.53。余裕を見て 150 まで
  vix: { min: 5, max: 150 },
  // CBOE SKEW は構造上 100 付近が下限。歴史的な上限は 160 台
  skew: { min: 100, max: 200 },
} as const;

export type SanityResult =
  | { ok: true; indicators: Indicators }
  | { ok: false; reason: string };

/**
 * 数値に寄せる。Number() に丸投げしない。
 * Number(null) と Number('') と Number([]) はいずれも 0 になるため、
 * 欠損がそのまま「fg=0（極度の恐怖）」として買いシグナルに化ける。
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // "--"（上流の欠損表現）や空文字を数値と見なさない
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function check(name: keyof typeof INDICATOR_RANGES, value: unknown): string | null {
  const num = toNumber(value);
  if (num === null) return `${name} が数値でない`;
  const { min, max } = INDICATOR_RANGES[name];
  if (num < min || num > max) return `${name}=${num} が想定範囲 ${min}-${max} の外`;
  return null;
}

/**
 * 3指標すべてが想定範囲なら使う。1つでも外れていたら理由を返して使わない。
 * 「疑わしい時は動かない」側に倒す。買い推奨を出さない方が損失が小さい。
 */
export function sanityCheckIndicators(raw: {
  fg?: unknown;
  vix?: unknown;
  skew?: unknown;
}): SanityResult {
  const reasons = (['fg', 'vix', 'skew'] as const)
    .map(name => check(name, raw[name]))
    .filter((r): r is string => r !== null);

  if (reasons.length > 0) return { ok: false, reason: reasons.join(' / ') };

  return {
    ok: true,
    indicators: {
      fg: toNumber(raw.fg) as number,
      vix: toNumber(raw.vix) as number,
      skew: toNumber(raw.skew) as number,
    },
  };
}
