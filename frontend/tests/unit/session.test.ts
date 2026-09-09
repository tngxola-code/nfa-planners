import { beforeAll, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';

const secret = 'test-secret-that-is-long-enough-for-tests';

beforeAll(() => {
  process.env.JWT_SECRET = secret;
});

describe('verifySessionToken', () => {
  it('accepts a valid backend-style JWT', async () => {
    const token = await new SignJWT({
      userId: 'user-123',
      role: 'ADMIN'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    const { verifySessionToken } = await import('@/lib/auth/session');

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: 'user-123',
      role: 'ADMIN'
    });
  });

  it('rejects invalid JWTs', async () => {
    const { verifySessionToken } = await import('@/lib/auth/session');

    const session = await verifySessionToken('invalid.token.value');

    expect(session).toBeNull();
  });
});
