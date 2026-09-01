/**
 * Console route protection.
 *
 * Runs on the Edge runtime: only edge-safe modules may be imported here
 * (jose-based session verification is fine; bcryptjs/node-only modules are
 * not — those stay in src/server/auth/credentials.ts, out of this graph).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "./server/auth/config";
import { verifySessionToken } from "./server/auth/session";

export const config = {
  matcher: ["/console/:path*"],
};

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // The login page itself must remain reachable.
  if (pathname === "/console/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/console/login", request.url);
  loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}
