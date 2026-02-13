import 'dotenv/config';
import prisma from '../src/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: { fullName: { contains: 'Haile', mode: 'insensitive' } },
    include: { citizenVerification: true },
  });

  if (users.length === 0) {
    console.log('User "Haile" not found.');
  }

  for (const user of users) {
    console.log(`User: ${user.fullName}, ID: ${user.id}`);
    console.log(`Trust Score: ${user.trustScore}`);
    console.log(`Verification Status: ${user.citizenVerification?.status ?? 'None'}`);
    const approved = await prisma.incident.count({
      where: { reporterId: user.id, reviewStatus: 'APPROVED' },
    });
    console.log(`Approved Incidents: ${approved}`);
  }
}

main().finally(() => prisma.$disconnect());
