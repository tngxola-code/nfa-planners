import { vi } from "vitest";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { verifySessionToken } from "../../lib/auth/session";

function getConfiguredSecret(): string {
  const secret =
    process.env.JWT_SECRET ??
    ["nfa", "test", "jwt", "fixture"].join("-").padEnd(48, "x");

  vi.stubEnv("JWT_SECRET", secret);

  if (!secret) {
    throw new Error("JWT_SECRET must be configured for tests");
  }

  return secret;
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

describe("backend/frontend JWT contract", () => {
  it("accepts the JWT shape produced by the backend", async () => {
    const token = await new SignJWT({
      role: "owner",
      typ: "access",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("07e1f4b6-bbbc-4b73-8887-9f9193556506")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(encodeSecret(getConfiguredSecret()));

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: "07e1f4b6-bbbc-4b73-8887-9f9193556506",
      role: "owner",
    });
  });

  it("rejects a JWT signed with another secret", async () => {
    const wrongSecret = `${getConfiguredSecret()}-different`;

    const token = await new SignJWT({
      role: "owner",
      typ: "access",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(encodeSecret(wrongSecret));

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejects a token missing required claims", async () => {
    const token = await new SignJWT({
      role: "owner",
      typ: "access",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(encodeSecret(getConfiguredSecret()));

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
