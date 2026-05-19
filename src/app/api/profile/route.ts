import { NextResponse } from 'next/server';
import { getProfile, setProfile, type Profile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getProfile());
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Partial<Profile>;
  return NextResponse.json(await setProfile(body));
}
