import 'dotenv/config';
import prisma from '../src/prisma';
import { reputationService } from '../src/modules/reputation/reputation.service';

async function main() {
  console.log('--- Testing Reputation Service ---');

  // 1. Create a dummy user
  const email = `test.reputation.${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      fullName: 'Reputation Tester',
      email,
      passwordHash: 'dummy',
      trustScore: 0,
      role: 'CITIZEN',
      citizenVerification: {
        create: {
          nationalId: '123',
          phone: '123',
          status: 'PENDING',
        },
      },
    },
    include: { citizenVerification: true },
  });

  console.log(`Created user ${user.id} with trustScore: ${user.trustScore}`);

  // 2. Simulate Verification Approval (Service Logic)
  // Logic from admin.routes.ts:
  // await prisma.citizenVerification.upsert({ ... })
  // await reputationService.onVerificationApproved(userId)

  await prisma.citizenVerification.update({
    where: { userId: user.id },
    data: { status: 'VERIFIED' },
  });

  await reputationService.onVerificationApproved(user.id);

  // 3. Verify Score
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`Updated user ${user.id} trustScore: ${updatedUser?.trustScore}`);

  if (updatedUser?.trustScore === 5) {
    console.log('SUCCESS: Trust score incremented by 5.');
  } else {
    console.error(`FAILURE: Expected 5, got ${updatedUser?.trustScore}`);
    process.exit(1);
  }

  // Cleanup
  await prisma.citizenVerification.delete({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
