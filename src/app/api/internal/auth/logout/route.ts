/**
 * Console logout: clears the session cookie and redirects to the login page.
 * Invoked via a plain POST form from the console shell.
 */

import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL("/console/login", request.url),
    303,
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
