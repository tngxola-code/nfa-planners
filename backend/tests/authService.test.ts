import { describe, expect, it, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { AuthService, AuthError } from '../src/services/authService.js';
import { createMemoryStore, type Store } from '../src/store.js';
import { generateInviteCode } from '../src/lib/inviteCodes.js';
import { UsersService } from '../src/services/usersService.js';
import type { User } from '../src/types/auth.js';

async function makeUser(store: Store, overrides: Partial<User> = {}): Promise<User> {
  const user: User = {
    id: 'u1',
    email: 'ops@nfaplanners.co.za',
    name: 'Test User',
    role: 'contributor',
    status: 'active',
    passwordHash: await bcrypt.hash('passwordvalue', 10),
    mfaEnabled: false,
    mfaSecret: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  await store.users.insert(user);
  return user;
}

describe('AuthService', () => {
  let store: Store;
  let auth: AuthService;
  const meta = { ip: '127.0.0.1', userAgent: 'vitest' };

  beforeEach(() => {
    store = createMemoryStore();
    auth = new AuthService(store);
  });

  it('logs in with correct password and returns tokens', async () => {
    await makeUser(store);
    const result = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta);
    expect(result.mfaRequired).toBe(false);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects wrong password with uniform 401', async () => {
    await makeUser(store);
    await expect(auth.login('ops@nfaplanners.co.za', 'wrong', meta)).rejects.toThrow(AuthError);
    await expect(auth.login('nobody@x.co.za', 'wrong', meta)).rejects.toThrow(AuthError);
  });

  it('challenges MFA then completes with valid TOTP', async () => {
    const secret = authenticator.generateSecret();
    await makeUser(store, { mfaEnabled: true, mfaSecret: secret });
    const challenge = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta);
    expect(challenge.mfaRequired).toBe(true);
    const token = authenticator.generate(secret);
    const done = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta,
      { mfaToken: challenge.mfaToken!, totp: token });
    expect(done.mfaRequired).toBe(false);
    expect(done.accessToken).toBeTruthy();
  });

  it('rejects bad TOTP code', async () => {
    const secret = authenticator.generateSecret();
    await makeUser(store, { mfaEnabled: true, mfaSecret: secret });
    const challenge = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta);
    await expect(auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta,
      { mfaToken: challenge.mfaToken!, totp: '000000' })).rejects.toThrow(AuthError);
  });

  it('rotates refresh tokens and rejects reuse of the old one', async () => {
    await makeUser(store);
    const first = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta);
    const rotated = await auth.refresh(first.refreshToken!);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    await expect(auth.refresh(first.refreshToken!)).rejects.toThrow(AuthError);
  });

  it('revoked session rejects refresh', async () => {
    await makeUser(store);
    const login = await auth.login('ops@nfaplanners.co.za', 'passwordvalue', meta);
    const sessions = await auth.listSessions('u1');
    await auth.revokeSession('u1', sessions[0].id);
    await expect(auth.refresh(login.refreshToken!)).rejects.toThrow(AuthError);
  });

  it('changes password only with correct current password', async () => {
    await makeUser(store);
    await expect(auth.changePassword('u1', 'nope', 'newpassword1')).rejects.toThrow(AuthError);
    await auth.changePassword('u1', 'passwordvalue', 'newpassword1');
    const ok = await auth.login('ops@nfaplanners.co.za', 'newpassword1', meta);
    expect(ok.mfaRequired).toBe(false);
  });
});

describe('UsersService', () => {
  let store: Store;
  let users: UsersService;

  beforeEach(async () => {
    store = createMemoryStore();
    users = new UsersService(store);
    await makeUser(store, { id: 'owner1', email: 'owner@nfa.co.za', role: 'owner' });
  });

  it('generates invite codes in NFA-XXXX-XX format', async () => {
    const invite = await users.invite('owner1', 'bid_manager');
    expect(invite.code).toMatch(/^NFA-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    expect(invite.role).toBe('bid_manager');
  });

  it('rejects invite generation from non-owner', async () => {
    await makeUser(store, { id: 'c1', email: 'c@nfa.co.za', role: 'contributor' });
    await expect(users.invite('c1', 'reviewer')).rejects.toThrow(AuthError);
  });

  it('redeems invite to create user; code is single-use', async () => {
    const invite = await users.invite('owner1', 'reviewer');
    const user = await users.redeemInvite(invite.code, 'Jane', 'jane@nfa.co.za', 'passwordvalue');
    expect(user.role).toBe('reviewer');
    await expect(users.redeemInvite(invite.code, 'X', 'x@nfa.co.za', 'passwordvalue')).rejects.toThrow(AuthError);
  });

  it('non-owner cannot change roles or remove users', async () => {
    await makeUser(store, { id: 'c1', email: 'c@nfa.co.za', role: 'contributor' });
    await makeUser(store, { id: 'v1', email: 'v@nfa.co.za', role: 'reviewer' });
    await expect(users.updateRole('c1', 'v1', 'owner')).rejects.toThrow(AuthError);
    await expect(users.remove('c1', 'v1')).rejects.toThrow(AuthError);
  });

  it('cannot disable or remove the owner', async () => {
    await expect(users.setStatus('owner1', 'owner1', 'disabled')).rejects.toThrow(AuthError);
    await expect(users.remove('owner1', 'owner1')).rejects.toThrow(AuthError);
  });
});

describe('invite code generator', () => {
  it('never uses ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[ILO01]/);
    }
  });
});
