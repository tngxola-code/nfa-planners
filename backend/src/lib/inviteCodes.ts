import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function block(length: number): string {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function generateInviteCode(): string {
  return `NFA-${block(4)}-${block(2)}`;
}
