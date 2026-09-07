/**
 * NFA Console JWT session implementation.
 *
 * EDGE-SAFE.
 *
 * JWT:
 * - HS256
 * - issuer
 * - audience
 * - subject
 * - session UUID (sid)
 * - token UUID (jti)
 * - role
 * - permissions
 * - issued-at
 * - expiry
 *
 * sid:
 * identifies the logical login session.
 *
 * jti:
 * identifies this specific JWT instance.
 */

import {
  SignJWT,
  jwtVerify,
  type JWTPayload,
} from "jose";

import {
  SESSION_AUDIENCE,
  SESSION_DURATION_SECONDS,
  SESSION_ISSUER,
  SESSION_TYPE,
  getSessionSecret,
} from "./config";

import {
  getPermissionsForRole,
  isConsolePermission,
  isConsoleRole,
  type ConsolePermission,
  type ConsoleRole,
} from "./authorization";

export interface ConsoleSession {
  email: string;
  role: ConsoleRole;
  permissions: ConsolePermission[];

  sessionId: string;
  tokenId: string;

  issuedAt: number;
  expiresAt: number;
}

interface ConsoleJwtPayload extends JWTPayload {
  email?: unknown;
  sid?: unknown;
  role?: unknown;
  permissions?: unknown;
  typ?: unknown;
}

export interface CreateSessionInput {
  email: string;
  role?: ConsoleRole;
}

export async function createSessionToken(
    input: CreateSessionInput,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const role = input.role ?? "admin";

  const permissions =
      getPermissionsForRole(role);

  const sessionId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();

  const nowSeconds =
      Math.floor(Date.now() / 1000);

  const expiresAt =
      nowSeconds + SESSION_DURATION_SECONDS;

  return new SignJWT({
    email,
    sid: sessionId,
    role,
    permissions,
    typ: SESSION_TYPE,
  })
      .setProtectedHeader({
        alg: "HS256",
        typ: "JWT",
      })
      .setSubject(email)
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setJti(tokenId)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(expiresAt)
      .sign(getSessionSecret());
}

export async function verifySessionToken(
    token: string,
): Promise<ConsoleSession | null> {
  try {
    const { payload } =
        await jwtVerify<ConsoleJwtPayload>(
            token,
            getSessionSecret(),
            {
              issuer: SESSION_ISSUER,
              audience: SESSION_AUDIENCE,
              algorithms: ["HS256"],
              clockTolerance: 5,
            },
        );

    if (payload.typ !== SESSION_TYPE) {
      return null;
    }

    if (typeof payload.email !== "string") {
      return null;
    }

    if (typeof payload.sub !== "string") {
      return null;
    }

    if (payload.sub !== payload.email) {
      return null;
    }

    if (typeof payload.sid !== "string") {
      return null;
    }

    if (typeof payload.jti !== "string") {
      return null;
    }

    if (typeof payload.iat !== "number") {
      return null;
    }

    if (typeof payload.exp !== "number") {
      return null;
    }

    if (!isConsoleRole(payload.role)) {
      return null;
    }

    if (!Array.isArray(payload.permissions)) {
      return null;
    }

    const permissions =
        payload.permissions.filter(
            isConsolePermission,
        );

    if (
        permissions.length !==
        payload.permissions.length
    ) {
      return null;
    }

    return {
      email: payload.email,
      role: payload.role,
      permissions,

      sessionId: payload.sid,
      tokenId: payload.jti,

      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}