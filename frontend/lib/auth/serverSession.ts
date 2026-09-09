import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from './config';
import { verifySessionToken } from './session';

export async function getSessionFromCookies() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
