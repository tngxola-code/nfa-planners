/**
 * NFA Console authentication/session configuration.
 *
 * EDGE-SAFE:
 * Middleware imports this module.
 *
 * CONSOLE_SESSION_SECRET must be a Base64-encoded random secret
 * containing at least 32 bytes of key material after decoding.
 */

export const SESSION_COOKIE_NAME = "nfa_console_session";

export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export const SESSION_ISSUER = "nfa-planners";
export const SESSION_AUDIENCE = "nfa-console";
export const SESSION_TYPE = "console_session";

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(
        Buffer.from(value, "base64"),
    );
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function getSessionSecret(): Uint8Array {
  const encodedSecret =
      process.env.CONSOLE_SESSION_SECRET?.trim();

  if (!encodedSecret) {
    throw new Error(
        "CONSOLE_SESSION_SECRET is not set.",
    );
  }

  let key: Uint8Array;

  try {
    key = base64ToBytes(encodedSecret);
  } catch {
    throw new Error(
        "CONSOLE_SESSION_SECRET must contain valid Base64 data.",
    );
  }

  if (key.length < 32) {
    throw new Error(
        "CONSOLE_SESSION_SECRET must decode to at least 32 bytes.",
    );
  }

  return key;
}