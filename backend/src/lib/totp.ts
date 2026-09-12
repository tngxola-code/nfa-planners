import { authenticator } from 'otplib';

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function mfaUri(secret: string, email: string): string {
  return authenticator.keyuri(email, 'NFA Console', secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
