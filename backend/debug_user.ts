import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const password = 'password123';

  console.log(`Checking user: ${email}`);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error('❌ User NOT found!');
    return;
  }

  console.log('✅ User found:', user.email);
  console.log('Stored Hash:', user.passwordHash);

  const match = await bcrypt.compare(password, user.passwordHash);
  if (match) {
    console.log('✅ Password Match: TRUE');
  } else {
    console.error('❌ Password Match: FALSE');
    // Try generating a new hash to see what it should look like
    const newHash = await bcrypt.hash(password, 10);
    console.log('Expected Hash format (example):', newHash);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
