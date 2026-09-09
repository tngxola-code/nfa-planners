import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, remember } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const backendUrl =
      process.env.BACKEND_URL ?? 'http://127.0.0.1:4000/v1';

    const backendResponse = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password
      }),
      cache: 'no-store'
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            data.error ??
            (backendResponse.status === 401
              ? 'Invalid credentials.'
              : 'Authentication failed.')
        },
        { status: backendResponse.status }
      );
    }

    const token = data.token;

    if (!token || typeof token !== 'string') {
      console.error('Backend login succeeded but no token was returned:', data);

      return NextResponse.json(
        { ok: false, error: 'Invalid authentication response.' },
        { status: 502 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: data.user,
      returnTo: '/dashboard'
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(remember ? { maxAge: SESSION_DURATION_SECONDS } : {})
    });

    return response;
  } catch (error) {
    console.error('Login proxy error:', error);

    return NextResponse.json(
      { ok: false, error: 'Authentication service unavailable.' },
      { status: 503 }
    );
  }
}
