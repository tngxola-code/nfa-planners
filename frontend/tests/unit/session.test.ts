import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { verifySessionToken } from "../../lib/auth/session";

function getTestSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET must be configured for tests");
  }

  return new TextEncoder().encode(secret);
}

describe("verifySessionToken", () => {
  it("accepts a valid backend-style JWT", async () => {
    const token = await new SignJWT({
      role: "owner",
      typ: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(getTestSecret());

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: "user-123",
      role: "owner",
    });
  });

  it("rejects invalid JWTs", async () => {
    await expect(verifySessionToken("not-a-valid-jwt")).resolves.toBeNull();
  });
});
