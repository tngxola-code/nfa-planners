import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { AccessTokenClaims, MfaTokenClaims, RefreshTokenClaims } from '../types/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;
const MFA_TTL = '5m';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export function signAccessToken(userId: string, role: string): string {
  const claims: AccessTokenClaims = { sub: userId, role: role as AccessTokenClaims['role'], typ: 'access' };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TTL, jwtid: crypto.randomUUID() });
}

export function signMfaToken(userId: string): string {
  const claims: MfaTokenClaims = { sub: userId, typ: 'mfa' };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: MFA_TTL, jwtid: crypto.randomUUID() });
}

export function signRefreshToken(userId: string, sessionId: string): string {
  const claims: RefreshTokenClaims = { sub: userId, sid: sessionId, typ: 'refresh' };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d`, jwtid: crypto.randomUUID() });
}

export function verifyToken<T>(token: string, expectedType: string): T {
  const decoded = jwt.verify(token, JWT_SECRET) as T;
  if ((decoded as { typ: unknown }).typ !== expectedType) {
    throw new Error('unexpected token type');
  }
  return decoded;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomId(): string {
  return crypto.randomUUID();
}
