import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

const TEST_SECRET =
  'nfa-integration-test-secret-at-least-32-bytes-long';

describe('backend/frontend JWT contract', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('accepts the JWT shape produced by the backend', async () => {
    const token = await new SignJWT({
      userId: '07e1f4b6-bbbc-4b73-8887-9f9193556506',
      role: 'ADMIN'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const { verifySessionToken } =
      await import('../../lib/auth/session');

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: '07e1f4b6-bbbc-4b73-8887-9f9193556506',
      role: 'ADMIN'
    });
  });

  it('rejects a JWT signed with another secret', async () => {
    const token = await new SignJWT({
      userId: 'user-123',
      role: 'ADMIN'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(
        new TextEncoder().encode(
          'different-integration-secret-at-least-32-bytes'
        )
      );

    const { verifySessionToken } =
      await import('../../lib/auth/session');

    const session = await verifySessionToken(token);

    expect(session).toBeNull();
  });

  it('rejects a token missing required claims', async () => {
    const token = await new SignJWT({
      role: 'ADMIN'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(TEST_SECRET));

    const { verifySessionToken } =
      await import('../../lib/auth/session');

    const session = await verifySessionToken(token);

    expect(session).toBeNull();
  });
});
