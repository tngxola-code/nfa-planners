import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/server/auth';

export const config = {
  matcher: [
    '/console/:path*',
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === '/console/login' || path.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session && path.startsWith('/console')) {
    const loginUrl = new URL('/console/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
