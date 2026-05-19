import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { computeReturns, type HistoricalData } from '@/lib/backtest';

const TICKERS = ['SPXL', 'TQQQ', 'QQQ', 'VTI', 'VT', 'GLDM', 'VYM', 'TLT'];

export async function GET() {
  const filePath = path.join(process.cwd(), 'public/data/historical.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw) as HistoricalData;
  const results = TICKERS.map((t) => computeReturns(data, t));
  return NextResponse.json(results);
}
