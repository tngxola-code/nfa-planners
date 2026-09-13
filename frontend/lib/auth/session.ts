import { jwtVerify } from "jose";

export type SessionRole = "owner" | "bid_manager" | "contributor" | "reviewer";

export interface Session {
  userId: string;
  role: SessionRole;
}

const SESSION_ROLES: readonly SessionRole[] = [
  "owner",
  "bid_manager",
  "contributor",
  "reviewer",
];

function isSessionRole(value: unknown): value is SessionRole {
  return (
    typeof value === "string" && SESSION_ROLES.includes(value as SessionRole)
  );
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      !isSessionRole(payload.role) ||
      payload.typ !== "access"
    ) {
      console.error("JWT contains invalid required claims");
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch (error) {
    console.error(
      "JWT verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return null;
  }
}
