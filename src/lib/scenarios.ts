import type { Phase } from './signals';

// 恐怖の深さの順（左ほど深い）。
// 2026-11-21 直し: 以前は ['HEAT','PERFECT','HIGH','WATCH','NEUTRAL'] で、
//  PERFECT の「1段悪化」に HEAT（過熱）が出ていた。HEAT は恐怖の反対側なので、右端に置く。
const order: Phase[] = ['PERFECT', 'HIGH', 'WATCH', 'NEUTRAL', 'HEAT'];

export function neighborPhases(current: Phase): { worse: Phase | null; better: Phase | null } {
  const idx = order.indexOf(current);
  return {
    worse: idx > 0 ? order[idx - 1] : null,
    better: idx < order.length - 1 ? order[idx + 1] : null,
  };
}
