import { NextResponse } from 'next/server';
import { computeReturns, type HistoricalData } from '@/lib/backtest';
import historical from '../../../../public/data/historical.json';

const TICKERS = ['SPXL', 'TQQQ', 'QQQ', 'VTI', 'VT', 'GLDM', 'VYM', 'TLT'];

export const dynamic = 'force-static';

export async function GET() {
  const data = historical as HistoricalData;
  const results = TICKERS.map((t) => computeReturns(data, t));
  return NextResponse.json(results);
}
