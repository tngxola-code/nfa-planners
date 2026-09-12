import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

const { prisma } = await import('./lib/prisma.js');
const { default: bcrypt } = await import('bcryptjs');

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set');
  process.exit(1);
}

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: 'owner', status: 'active' },
    create: {
      email: email.toLowerCase(),
      name: 'E2E Admin',
      role: 'owner',
      status: 'active',
      passwordHash,
    },
  });
  console.log(`Seeded admin: ${user.email} (role: ${user.role})`);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
