import 'dotenv/config';
import prisma from '../src/prisma';

async function main() {
  const url = process.env.DATABASE_URL || '';
  // Mask the password in the URL for logging
  const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
  console.log(`Checking DB Connection to: ${maskedUrl}`);

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    await prisma.$disconnect();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Database connection failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
