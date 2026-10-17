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

  // PERFECT は phase_change 経由でしか表に出なかった。
  // 遷移の記録(KV)が飛んだ場合や、ロックで遷移通知が落ちた場合に
  // 最重要の局面を取りこぼすため、状態そのものの通知を独立で立てる。
  if (phase === 'PERFECT') {
    out.push({
      key: 'perfect_now',
      title: '🟢 PERFECT（買いシグナル 3/3）',
      detail: `F&G:${ind.fg} VIX:${ind.vix} Skew:${ind.skew}`,
      phase,
    });
  }

  return out;
}

// 通知のロック鍵。
// フェーズ遷移は「遷移そのもの」を鍵にする。全遷移が 'phase_change' という
// 単一の鍵を共有していたため、WATCH→HIGH→PERFECT と24時間以内に進むと
// 最重要の通知が黙って捨てられていた。
export function lockKeyFor(alertKey: string, prevPhase: Phase | null, currentPhase: Phase): string {
  if (alertKey !== 'phase_change') return alertKey;
  return `phase_change:${prevPhase ?? 'NONE'}->${currentPhase}`;
}

export const ALERT_LOCK_HOURS = 24;
export const ESCALATION_LOCK_HOURS = 1;

// 買い場へ上がる遷移は取りこぼさない。それ以外は従来どおり24時間ロック。
export function lockHoursFor(alertKey: string, currentPhase: Phase): number {
  if (alertKey === 'phase_change' && (currentPhase === 'PERFECT' || currentPhase === 'HIGH')) {
    return ESCALATION_LOCK_HOURS;
  }
  return ALERT_LOCK_HOURS;
}
