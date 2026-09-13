export type Role = 'owner' | 'bid_manager' | 'contributor' | 'reviewer';
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface Invite {
  code: string;
  role: Role;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  typ: 'access';
}

export interface MfaTokenClaims {
  sub: string;
  typ: 'mfa';
}

export interface RefreshTokenClaims {
  sub: string;
  sid: string;
  typ: 'refresh';
}
