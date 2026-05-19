export type HistEvent = {
  date: string;
  intensity: 'PERFECT' | 'HIGH' | 'WATCH';
  fg: number;
  vix_peak: number;
  skew_peak: number;
  context: string;
};

export type HistoricalData = {
  events: HistEvent[];
  current_prices: Record<string, number>;
  event_prices: Record<string, Record<string, number>>;
};

export type EventReturn = {
  date: string;
  context: string;
  intensity: HistEvent['intensity'];
  returnPct: number;
};

export type BacktestResult = {
  ticker: string;
  byEvent: EventReturn[];
  avgReturnPct: number;
  winRate: number;
};

export function computeReturns(data: HistoricalData, ticker: string): BacktestResult {
  const current = data.current_prices[ticker];
  if (current === undefined) return { ticker, byEvent: [], avgReturnPct: 0, winRate: 0 };

  const byEvent: EventReturn[] = data.events
    .map((ev) => {
      const price = data.event_prices[ev.date]?.[ticker];
      if (price === undefined) return null;
      return {
        date: ev.date,
        context: ev.context,
        intensity: ev.intensity,
        returnPct: (current - price) / price,
      };
    })
    .filter((x): x is EventReturn => x !== null);

  if (byEvent.length === 0) return { ticker, byEvent: [], avgReturnPct: 0, winRate: 0 };

  const avg = byEvent.reduce((s, e) => s + e.returnPct, 0) / byEvent.length;
  const winRate = byEvent.filter((e) => e.returnPct > 0).length / byEvent.length;

  return { ticker, byEvent, avgReturnPct: avg, winRate };
}
