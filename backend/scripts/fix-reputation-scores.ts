import 'dotenv/config';
import prisma from '../src/prisma';

const MIN = -20;
const MAX = 100;
const clamp = (val: number) => Math.max(MIN, Math.min(MAX, val));

async function main() {
  console.log('Starting Reputation Consistency Check...');
  const users = await prisma.user.findMany({
    include: { citizenVerification: true },
  });

  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    const approvedCount = await prisma.incident.count({
      where: { reporterId: user.id, reviewStatus: 'APPROVED' },
    });
    const rejectedCount = await prisma.incident.count({
      where: { reporterId: user.id, reviewStatus: 'REJECTED' },
    });

    let score = 0;
    if (user.citizenVerification?.status === 'VERIFIED') {
      score += 5;
    }
    score += approvedCount * 5;
    score -= rejectedCount * 10;
    score = clamp(score);

    // Check consistency
    // Note: totalReports might track all submissions, not just reviewed ones.
    // We only sync valid/rejected and score.

    if (
      score !== user.trustScore ||
      approvedCount !== user.validReports ||
      rejectedCount !== user.rejectedReports
    ) {
      console.log(
        `Fixing User ${user.id} (${user.fullName}): Score ${user.trustScore}->${score}, Valid ${user.validReports}->${approvedCount}, Rejected ${user.rejectedReports}->${rejectedCount}`,
      );
      await prisma.user.update({
        where: { id: user.id },
        data: {
          trustScore: score,
          validReports: approvedCount,
          rejectedReports: rejectedCount,
        },
      });
    }
  }
  console.log('Reputation Consistency Check Complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
