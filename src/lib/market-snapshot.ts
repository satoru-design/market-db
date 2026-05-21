export type IndexQuote = { price: number; changePct: number | null } | null;

export type IndexSnapshot = {
  n225: IndexQuote;
  topx: IndexQuote;
  gspc: IndexQuote;
  dji: IndexQuote;
  ixic: IndexQuote;
  usdjpy: IndexQuote;
};

const SYMBOL_MAP = {
  n225: '^N225',
  topx: '^TOPX',
  gspc: '^GSPC',
  dji: '^DJI',
  ixic: '^IXIC',
  usdjpy: 'USDJPY=X',
} as const;

type Key = keyof typeof SYMBOL_MAP;

export function calcChangePct(current: number, prev: number | null | undefined): number | null {
  if (!prev || prev === 0) return null;
  return (current - prev) / prev;
}

async function fetchOne(symbol: string): Promise<IndexQuote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        next: { revalidate: 0 },
      }
    );
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    if (typeof price !== 'number') return null;
    return { price, changePct: calcChangePct(price, prev) };
  } catch {
    return null;
  }
}

export async function fetchSnapshot(): Promise<IndexSnapshot> {
  const keys = Object.keys(SYMBOL_MAP) as Key[];
  const results = await Promise.all(keys.map(k => fetchOne(SYMBOL_MAP[k])));
  const snap = {} as IndexSnapshot;
  keys.forEach((k, i) => {
    snap[k] = results[i];
  });
  return snap;
}

function fmtQuote(label: string, q: IndexQuote, priceDigits = 0): string {
  if (!q) return `${label} --`;
  const priceStr = q.price.toLocaleString('en-US', { minimumFractionDigits: priceDigits, maximumFractionDigits: priceDigits });
  if (q.changePct === null) return `${label} ${priceStr}`;
  const pct = (q.changePct * 100).toFixed(1);
  const sign = q.changePct >= 0 ? '+' : '';
  return `${label} ${priceStr} (${sign}${pct}%)`;
}

export function formatSnapshot(snap: IndexSnapshot): string {
  const line1 = `${fmtQuote('日経', snap.n225)} / ${fmtQuote('TOPIX', snap.topx)}`;
  const line2 = `${fmtQuote('ダウ', snap.dji)} / ${fmtQuote('ナス', snap.ixic)} / ${fmtQuote('S&P', snap.gspc)}`;
  const line3 = fmtQuote('USDJPY', snap.usdjpy, 2);
  return `${line1}\n${line2}\n${line3}`;
}
