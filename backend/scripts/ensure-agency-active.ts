import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Ensuring Agency 1 is active...');
    await prisma.agency.upsert({
      where: { id: 1 },
      update: { isActive: true, isApproved: true },
      create: {
        id: 1,
        name: 'Test Agency',
        type: 'POLICE',
        city: 'Addis Ababa',
        isActive: true,
        isApproved: true,
      },
    });
    console.log('Agency 1 active.');
  } catch (e: any) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
