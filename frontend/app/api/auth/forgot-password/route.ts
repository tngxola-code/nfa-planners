import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ ok: false, error: 'Email required' }, { status: 400 });
  // Proxy to backend
  const backendUrl = process.env.BACKEND_URL;
  await fetch(`${backendUrl}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return NextResponse.json({ ok: true, message: 'If the email exists, a reset link has been sent' });
}
