import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/server/auth';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      user: { email: session.email, role: session.role }
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
