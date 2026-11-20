import { NextResponse } from 'next/server';
import { fetchQuotes } from '@/lib/quotes';

// 株数の計算に使う株価（ドル）とドル円。取り方の正本は lib/quotes.ts（通知と共通）。

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await fetchQuotes());
}
