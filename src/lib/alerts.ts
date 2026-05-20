import { detectPhase, type Indicators, type Phase } from './signals';

export type Alert = {
  key: string;
  title: string;
  detail: string;
  phase: Phase;
};

export function detectAlerts(ind: Indicators, prevPhase: Phase | null): Alert[] {
  const phase = detectPhase(ind);
  const out: Alert[] = [];

  if (ind.vix > 30) {
    out.push({ key: 'vix_spike', title: 'VIX SPIKE', detail: `VIX: ${ind.vix}`, phase });
  }
  if (ind.fg < 20) {
    out.push({ key: 'fg_panic', title: 'F&G PANIC', detail: `F&G: ${ind.fg}`, phase });
  }
  if (ind.skew > 150) {
    out.push({ key: 'skew_high', title: 'SKEW HIGH', detail: `Skew: ${ind.skew}`, phase });
  }
  if (prevPhase && prevPhase !== phase) {
    out.push({ key: 'phase_change', title: `PHASE CHANGE: ${prevPhase} → ${phase}`, detail: `F&G:${ind.fg} VIX:${ind.vix} Skew:${ind.skew}`, phase });
  }

  return out;
}
