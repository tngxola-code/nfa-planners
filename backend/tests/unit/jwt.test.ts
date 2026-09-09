import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../src/utils/jwt';

describe('JWT utilities', () => {
  it('signs and verifies a valid token', async () => {
    const token = await signToken({
      userId: 'user-123',
      role: 'ADMIN'
    });

    expect(token).toBeTruthy();

    const payload = await verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('user-123');
    expect(payload?.role).toBe('ADMIN');
  });

  it('rejects an invalid token', async () => {
    const payload = await verifyToken('invalid.jwt.token');

    expect(payload).toBeNull();
  });
});
