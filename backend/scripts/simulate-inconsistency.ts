import 'dotenv/config';
import prisma from '../src/prisma';

async function main() {
  const user = await prisma.user.findFirst({
    where: { fullName: { contains: 'Haile', mode: 'insensitive' } },
    include: { citizenVerification: true },
  });

  if (!user) {
    console.log('Haile not found');
    return;
  }

  // Set status to VERIFIED but keep score 0 (Inconsistent state)
  await prisma.citizenVerification.upsert({
    where: { userId: user.id },
    update: { status: 'VERIFIED' },
    create: { userId: user.id, status: 'VERIFIED', nationalId: 'simulated', phone: 'simulated' },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { trustScore: 0 },
  });

  console.log(`Simulated inconsistency for ${user.fullName}: Status=VERIFIED, Score=0`);
}
main().finally(() => prisma.$disconnect());
