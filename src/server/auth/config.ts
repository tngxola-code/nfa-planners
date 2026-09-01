/**
 * Console session configuration.
 *
 * EDGE-SAFE: this module is imported by src/middleware.ts (Edge runtime).
 * It must not import node-only modules (`node:*`, bcryptjs, resend, ...).
 * The edge sandbox has no `Buffer` global, so base64 decoding falls back to
 * `atob` (available in both the Edge runtime and Node >= 16).
 */

export const SESSION_COOKIE_NAME = "nfa_console_session";

/** Sessions last 8 hours. */
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function base64ToBytes(value: string): Uint8Array {
  // Prefer Buffer.from when available (Node route handlers); fall back to
  // atob in the Edge runtime where Buffer is not a global.
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * HS256 key material for session tokens, from the base64-encoded
 * CONSOLE_SESSION_SECRET environment variable.
 */
export function getSessionSecret(): Uint8Array {
  const secret = process.env.CONSOLE_SESSION_SECRET;
  if (!secret) {
    throw new Error("CONSOLE_SESSION_SECRET is not set.");
  }
  const key = base64ToBytes(secret);
  if (key.length < 32) {
    throw new Error(
      "CONSOLE_SESSION_SECRET must contain at least 32 bytes of key material.",
    );
  }
  return key;
}
