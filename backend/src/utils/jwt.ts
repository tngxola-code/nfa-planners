import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env';

const secret = new TextEncoder().encode(env.jwtSecret);

export interface AuthTokenPayload {
  userId: string;
  role: string;
}

export async function signToken(payload: AuthTokenPayload) {
  const jwtPayload: JWTPayload = {
    userId: payload.userId,
    role: payload.role
  };

  return new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role
    };
  } catch {
    return null;
  }
}
