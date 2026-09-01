/**
 * Post-login redirect target sanitisation.
 *
 * Pure + edge-safe. Prevents open redirects: only same-origin paths beneath
 * the console (excluding the login page itself) are honoured.
 */

export const DEFAULT_RETURN_TO = "/console";

/**
 * Return a safe post-login path. Rejects:
 *  - null/empty values                          -> default,
 *  - protocol-relative URLs ("//evil.example")  -> default,
 *  - anything outside "/console/..."            -> default,
 *  - the login page itself (redirect loops)     -> default.
 */
export function sanitiseReturnTo(value: string | null): string {
  if (!value) return DEFAULT_RETURN_TO;
  if (value.startsWith("//")) return DEFAULT_RETURN_TO;
  if (!value.startsWith("/console/")) return DEFAULT_RETURN_TO;
  if (value.startsWith("/console/login")) return DEFAULT_RETURN_TO;
  return value;
}
