import { NextResponse } from 'next/server';
import { getProfile, setProfile } from '@/lib/profile';
import { parseProfilePatch } from '@/lib/profile-patch';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getProfile());
}

// 2026-11-21 中身を検証してから KV に書くようにした（以前は何でも書いていた）。
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '中身が読めませんでした' }, { status: 400 });
  }
  const parsed = parseProfilePatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json(await setProfile(parsed.patch));
}
