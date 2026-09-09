import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { signToken } from '../utils/jwt';

export async function createUser(email: string, password: string, role: string = 'ADMIN') {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, role }
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;
  return user;
}

export async function generateSession(userId: string, role: string) {
  return signToken({ userId, role });
}
