import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SESSION_SECRET = process.env.CONSOLE_SESSION_SECRET!;
const ADMIN_EMAIL = process.env.CONSOLE_ADMIN_EMAIL!;
const ADMIN_PASSWORD_HASH = process.env.CONSOLE_ADMIN_PASSWORD_HASH!;

export type SessionPayload = {
  id: string;
  email: string;
  role: 'admin';
};

export class SessionTokenMissingError extends Error {
  constructor() {
    super('Session token missing');
    this.name = 'SessionTokenMissingError';
  }
}

export class SessionTokenExpiredError extends Error {
  constructor() {
    super('Session token expired');
    this.name = 'SessionTokenExpiredError';
  }
}

export class SessionTokenInvalidError extends Error {
  constructor() {
    super('Session token invalid');
    this.name = 'SessionTokenInvalidError';
  }
}

export async function verifyConsoleCredentials(email: string, password: string): Promise<SessionPayload | null> {
  if (email !== ADMIN_EMAIL) {
    await bcrypt.compare('dummy', '$2b$10$dummyhash');
    return null;
  }

  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!match) return null;

  return {
    id: 'console-admin',
    email: ADMIN_EMAIL,
    role: 'admin',
  };
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return await new SignJWT({ ...payload, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  if (!token) {
    throw new SessionTokenMissingError();
  }
  try {
    const secret = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (err: any) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      throw new SessionTokenExpiredError();
    }
    throw new SessionTokenInvalidError();
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const cookie = request.cookies.get('nfa_console_session');
  if (!cookie) return null;
  try {
    return await verifySessionToken(cookie.value);
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('nfa_console_session')?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete('nfa_console_session');
}
