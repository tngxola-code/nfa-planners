import bcrypt from 'bcryptjs';
import type { Session, User } from '../types/auth.js';
import type { Store } from '../store.js';
import {
  randomId, sha256, signAccessToken, signMfaToken, signRefreshToken,
  verifyToken,
} from '../lib/tokens.js';
import { verifyTotp } from '../lib/totp.js';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface LoginResult {
  mfaRequired: boolean;
  mfaToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: { id: string; email: string; name: string; role: User['role'] };
}

export class AuthService {
  constructor(private store: Store) {}

  async login(
    email: string,
    password: string,
    meta: { ip?: string; userAgent?: string },
    mfa?: { mfaToken: string; totp: string },
  ): Promise<LoginResult> {
    const user = await this.store.users.findByEmail(email);
    if (!user || user.status === 'disabled' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthError(401, 'Invalid credentials');
    }

    if (user.mfaEnabled && !mfa) {
      return { mfaRequired: true, mfaToken: signMfaToken(user.id) };
    }

    if (user.mfaEnabled && mfa) {
      const claims = verifyToken<{ sub: string; typ: string }>(mfa.mfaToken, 'mfa');
      if (claims.sub !== user.id) throw new AuthError(401, 'Invalid MFA challenge');
      if (!user.mfaSecret || !verifyTotp(mfa.totp, user.mfaSecret)) {
        throw new AuthError(401, 'Invalid MFA code');
      }
    }

    const session: Session = {
      id: randomId(),
      userId: user.id,
      refreshTokenHash: '',
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
    };
    const refreshToken = signRefreshToken(user.id, session.id);
    session.refreshTokenHash = sha256(refreshToken);
    await this.store.sessions.insert(session);

    return {
      mfaRequired: false,
      accessToken: signAccessToken(user.id, user.role),
      refreshToken,
      expiresIn: 900,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let claims;
    try {
      claims = verifyToken<{ sub: string; sid: string; typ: string }>(refreshToken, 'refresh');
    } catch {
      throw new AuthError(401, 'Invalid refresh token');
    }
    const session = await this.store.sessions.findById(claims.sid);
    if (!session || session.revokedAt || session.refreshTokenHash !== sha256(refreshToken)) {
      throw new AuthError(401, 'Session expired — sign in again');
    }
    const user = await this.store.users.findById(claims.sub);
    if (!user || user.status !== 'active') throw new AuthError(401, 'Account unavailable');

    const nextRefresh = signRefreshToken(user.id, session.id);
    await this.store.sessions.update(session.id, {
      refreshTokenHash: sha256(nextRefresh),
      lastSeenAt: new Date().toISOString(),
    });
    return { accessToken: signAccessToken(user.id, user.role), refreshToken: nextRefresh, expiresIn: 900 };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.store.users.findById(userId);
    if (!user) throw new AuthError(404, 'User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AuthError(403, 'Current password incorrect');
    }
    if (newPassword.length < 8) throw new AuthError(400, 'Password must be at least 8 characters');
    await this.store.users.update(userId, { passwordHash: await bcrypt.hash(newPassword, 10) });
  }

  async listSessions(userId: string) {
    const sessions = await this.store.sessions.listByUser(userId);
    return sessions
      .filter((s) => !s.revokedAt)
      .map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
      }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.store.sessions.findById(sessionId);
    if (!session || session.userId !== userId) throw new AuthError(404, 'Session not found');
    await this.store.sessions.update(sessionId, { revokedAt: new Date().toISOString() });
  }

  static async seedOwner(store: Store): Promise<void> {
    const email = process.env.SEED_OWNER_EMAIL;
    const password = process.env.SEED_OWNER_PASSWORD;
    if (!email || !password) return;
    if (await store.users.findByEmail(email)) return;
    await store.users.insert({
      id: randomId(),
      email: email.toLowerCase(),
      name: 'NFA Administrator',
      role: 'owner',
      status: 'active',
      passwordHash: await bcrypt.hash(password, 10),
      mfaEnabled: false,
      mfaSecret: null,
      createdAt: new Date().toISOString(),
    });
  }
}
