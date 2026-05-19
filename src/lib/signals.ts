import type { Phase } from '@/data/portfolio';

export type Indicators = { fg: number; vix: number; skew: number };
export type Signal = { name: string; active: boolean };

export function buySignals(ind: Indicators): Signal[] {
  return [
    { name: 'F&G', active: ind.fg <= 30 },
    { name: 'VIX', active: ind.vix >= 28 },
    { name: 'Skew', active: ind.skew <= 118 },
  ];
}

export function detectPhase(ind: Indicators): Phase {
  if (ind.fg >= 75) return 'HEAT';
  const active = buySignals(ind).filter((s) => s.active).length;
  if (active === 3) return 'PERFECT';
  if (active === 2) return 'HIGH';
  if (active === 1) return 'WATCH';
  return 'NEUTRAL';
}

export type { Phase };
