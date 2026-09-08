/**
 * Safe console post-login redirect handling.
 *
 * Prevents open redirects.
 *
 * Only local /console paths are permitted.
 */

export const DEFAULT_RETURN_TO =
    "/console/dashboard";

export function sanitiseReturnTo(
    value: string | null,
): string {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }

  if (!value.startsWith("/")) {
    return DEFAULT_RETURN_TO;
  }

  if (value.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }

  try {
    const url = new URL(
        value,
        "https://nfa.invalid",
    );

    const pathname = url.pathname;

    const isConsolePath =
        pathname === "/console" ||
        pathname.startsWith("/console/");

    if (!isConsolePath) {
      return DEFAULT_RETURN_TO;
    }

    if (
        pathname === "/console/login" ||
        pathname.startsWith(
            "/console/login/",
        )
    ) {
      return DEFAULT_RETURN_TO;
    }

    /*
     * Normalise the generic console root
     * to the dashboard.
     */
    if (pathname === "/console") {
      return DEFAULT_RETURN_TO;
    }

    return `${pathname}${url.search}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}