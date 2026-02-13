import 'dotenv/config';
import prisma from '../src/prisma';

async function main() {
  const user = await prisma.user.findFirst({
    where: { fullName: { contains: 'Haile', mode: 'insensitive' } },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  const incidents = await prisma.incident.findMany({
    where: { reporterId: user.id },
  });

  console.log(`User: ${user.fullName} (${user.id})`);
  console.log(`Trust Score: ${user.trustScore}`);
  console.log('Incidents:', incidents.length);
  incidents.forEach((i) => {
    console.log(`- ID ${i.id}: Status=${i.status}, Review=${i.reviewStatus}, Title=${i.title}`);
  });
}
main().finally(() => prisma.$disconnect());
