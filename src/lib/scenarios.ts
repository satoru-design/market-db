import type { Phase } from './signals';

const order: Phase[] = ['HEAT', 'PERFECT', 'HIGH', 'WATCH', 'NEUTRAL'];

export function neighborPhases(current: Phase): { worse: Phase | null; better: Phase | null } {
  const idx = order.indexOf(current);
  return {
    worse: idx > 0 ? order[idx - 1] : null,
    better: idx < order.length - 1 ? order[idx + 1] : null,
  };
}
