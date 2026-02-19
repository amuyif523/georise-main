import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking Prisma Client properties...');
  if ('classificationAudit' in prisma) {
    console.log('✅ prisma.classificationAudit exists!');
  } else {
    console.error('❌ prisma.classificationAudit DOES NOT exist.');
    console.log(
      'Keys:',
      Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_')),
    );
  }

  await prisma.$disconnect();
}

main();
