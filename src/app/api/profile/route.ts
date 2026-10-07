import { NextResponse } from 'next/server';
import { getProfile, setProfile } from '@/lib/profile';
import { forbidden, isUnlocked } from '@/lib/api-auth';
import { validateProfilePatch } from '@/lib/profile-validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isUnlocked())) return forbidden();
  return NextResponse.json(await getProfile());
}

export async function PATCH(request: Request) {
  if (!(await isUnlocked())) return forbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const result = validateProfilePatch(body);
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid body', details: result.errors }, { status: 400 });
  }

  return NextResponse.json(await setProfile(result.patch));
}
