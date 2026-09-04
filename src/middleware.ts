import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths (no auth required)
  const publicPaths = ['/login', '/_next', '/favicon.ico']
  if (publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const session = request.cookies.get('nfa_session')
  if (!session || session.value !== 'authenticated') {
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', path)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
