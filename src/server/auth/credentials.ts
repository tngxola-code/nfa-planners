/**
 * Console credential verification against environment configuration.
 *
 * SERVER-ONLY (Node runtime): uses bcryptjs. NOT edge-safe — never import
 * this module from middleware or edge route handlers.
 *
 * NOTE: bcryptjs is imported lazily (same pattern as resend in
 * src/server/notifications/sendDigest.ts) so the offline smoke loader can
 * transpile/require src/server modules without resolving bare packages.
 */

/**
 * A valid bcrypt hash used purely for timing parity: when the email does not
 * match we still run a bcrypt comparison against this dummy hash so the
 * response time does not reveal whether the email exists.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$10$zBS6sWGdvOx7qOdDp0lBRecQDQOl7mDauRvCCQVJoVjL0onL4gBye";

/**
 * Verify a login attempt against CONSOLE_AUTH_EMAIL (case-insensitive,
 * trimmed) and CONSOLE_AUTH_PASSWORD_HASH (bcrypt). Throws when the
 * environment is not configured.
 */
export async function verifyConsoleCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const configuredEmail = process.env.CONSOLE_AUTH_EMAIL;
  const passwordHash = process.env.CONSOLE_AUTH_PASSWORD_HASH;
  if (!configuredEmail || !passwordHash) {
    throw new Error("Console authentication credentials are not configured.");
  }

  const bcrypt = (await import("bcryptjs")).default;

  const emailMatches =
    email.trim().toLowerCase() === configuredEmail.trim().toLowerCase();
  // Always bcrypt-compare, even on email mismatch, to blunt
  // user-enumeration timing attacks.
  const passwordMatches = await bcrypt.compare(
    password,
    emailMatches ? passwordHash : DUMMY_PASSWORD_HASH,
  );

  return emailMatches && passwordMatches;
}

/** Normalised identity stored in the session token. */
export function normaliseConsoleEmail(email: string): string {
  return email.trim().toLowerCase();
}
