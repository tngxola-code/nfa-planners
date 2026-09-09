export function generateInviteCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const randomChar = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const part1 = Array.from({ length: 4 }, () => randomChar(letters)).join('');
  const part2 = Array.from({ length: 4 }, () => randomChar(digits)).join('');
  const part3 = Array.from({ length: 2 }, () => randomChar(letters)).join('');
  return `NFA-${part1}-${part2}-${part3}`;
}
