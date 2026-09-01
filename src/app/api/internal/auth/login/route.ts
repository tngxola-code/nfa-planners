/**
 * Console login: verifies credentials and sets the session cookie.
 *
 * POST body: { email, password, returnTo? }
 * Success: 200 { ok: true, returnTo } + session cookie
 * Failure: 401 { ok: false, error } (same body for bad credentials and
 *            malformed payloads — no user enumeration)
 */

import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/server/auth/config";
import { createSessionToken } from "@/server/auth/session";
import {
  normaliseConsoleEmail,
  verifyConsoleCredentials,
} from "@/server/auth/credentials";
import { sanitiseReturnTo } from "@/server/auth/returnTo";

// bcryptjs runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_RESPONSE = { ok: false, error: "Invalid email or password" };

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_RESPONSE, { status: 401 });
  }

  const { email, password, returnTo } = (body ?? {}) as Record<string, unknown>;
  const safeReturnTo = sanitiseReturnTo(
    typeof returnTo === "string" ? returnTo : null,
  );

  let valid = false;
  try {
    valid = await verifyConsoleCredentials(
      typeof email === "string" ? email : "",
      typeof password === "string" ? password : "",
    );
  } catch (err) {
    // Misconfigured environment — do not leak details to the client.
    console.error("login failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Authentication is not configured." },
      { status: 500 },
    );
  }

  if (!valid || typeof email !== "string") {
    return NextResponse.json(INVALID_RESPONSE, { status: 401 });
  }

  const token = await createSessionToken(normaliseConsoleEmail(email));
  const response = NextResponse.json({ ok: true, returnTo: safeReturnTo });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
