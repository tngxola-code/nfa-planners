/**
 * NFA Console credential verification.
 *
 * SERVER-ONLY.
 *
 * Zero Trust rules:
 * - No credentials, password hashes or cryptographic material in source code.
 * - Password verification uses bcrypt.
 * - Unknown users are bcrypt-compared against a dummy hash to reduce
 *   account-enumeration timing differences.
 * - Authentication configuration is supplied exclusively through the
 *   runtime environment / secret manager.
 */

export function normaliseConsoleEmail(
    email: string,
): string {
  return email.trim().toLowerCase();
}

function getAuthenticationConfiguration(): {
  email: string;
  passwordHash: string;
  dummyPasswordHash: string;
} {
  const email =
      process.env.CONSOLE_AUTH_EMAIL
          ?.trim()
          .toLowerCase();

  const passwordHash =
      process.env.CONSOLE_AUTH_PASSWORD_HASH
          ?.trim();

  const dummyPasswordHash =
      process.env.CONSOLE_AUTH_DUMMY_PASSWORD_HASH
          ?.trim();

  if (!email) {
    throw new Error(
        "CONSOLE_AUTH_EMAIL is not configured.",
    );
  }

  if (!passwordHash) {
    throw new Error(
        "CONSOLE_AUTH_PASSWORD_HASH is not configured.",
    );
  }

  if (!dummyPasswordHash) {
    throw new Error(
        "CONSOLE_AUTH_DUMMY_PASSWORD_HASH is not configured.",
    );
  }

  return {
    email,
    passwordHash,
    dummyPasswordHash,
  };
}

export async function verifyConsoleCredentials(
    email: string,
    password: string,
): Promise<boolean> {
  const configuration =
      getAuthenticationConfiguration();

  const bcrypt =
      (await import("bcryptjs")).default;

  const normalisedEmail =
      normaliseConsoleEmail(email);

  const emailMatches =
      normalisedEmail === configuration.email;

  /*
   * Always execute bcrypt comparison.
   *
   * When the email is unknown, compare against a dummy bcrypt hash
   * instead of skipping the expensive password operation.
   *
   * This reduces observable timing differences between:
   *
   * - known account + invalid password
   * - unknown account
   */
  const comparisonHash =
      emailMatches
          ? configuration.passwordHash
          : configuration.dummyPasswordHash;

  const passwordMatches =
      await bcrypt.compare(
          password,
          comparisonHash,
      );

  return (
      emailMatches &&
      passwordMatches
  );
}