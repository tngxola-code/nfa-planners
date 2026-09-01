/**
 * Console session tokens (HS256 JWTs via jose).
 *
 * EDGE-SAFE: imported by src/middleware.ts — jose is edge-compatible and this
 * module must not gain node-only imports.
 *
 * NOTE: relative imports only in src/server — the offline smoke loader
 * transpiles TS→CJS without Next's "@/" path-alias resolution.
 */

import { SignJWT, jwtVerify } from "jose";

import { SESSION_DURATION_SECONDS, getSessionSecret } from "./config";

const ISSUER = "nfa-planners";
const AUDIENCE = "nfa-console";

export interface ConsoleSession {
  email: string;
}

/** Sign a new session token for the given console user email. */
export async function createSessionToken(email: string): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + SESSION_DURATION_SECONDS)
    .sign(getSessionSecret());
}

/**
 * Verify a session token. Returns the session payload, or null for ANY
 * failure (bad signature, expired, wrong issuer/audience, malformed,
 * missing/short secret) — callers treat null as "not signed in".
 */
export async function verifySessionToken(
  token: string,
): Promise<ConsoleSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
