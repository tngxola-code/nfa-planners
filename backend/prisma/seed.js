const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@nfa.co.za';
  const password = 'YourSecurePassword123!'; // Change this to your desired password

  const passwordHash = await bcrypt.hash(password, 12);

  // Create or update admin user
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: 'ADMIN' },
  });

  console.log('Admin user created/updated:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Bcrypt Hash: ${passwordHash}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
