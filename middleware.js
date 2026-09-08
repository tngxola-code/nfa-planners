import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths (no auth required)
  const publicPaths = ['/console/login', '/api/internal/auth/login'];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/console/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback-secret'
    );
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/console/login', request.url));
  }
}

export const config = {
  matcher: ['/console/:path*', '/api/console/:path*'],
};
