import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'staff1@example.com' },
    include: {
      agencyStaff: {
        include: {
          agency: true,
        },
      },
    },
  });

  if (!user) {
    console.log('User staff1@example.com not found');
    return;
  }

  console.log('User Role:', user.role);

  if (user.agencyStaff) {
    console.log('Agency Staff Record Found');
    console.log('Agency ID:', user.agencyStaff.agencyId);
    console.log('Agency Name:', user.agencyStaff.agency.name);
    console.log('Agency Type:', user.agencyStaff.agency.type);
  } else {
    console.log('User is NOT linked to any agency (agencyStaff record is null)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
