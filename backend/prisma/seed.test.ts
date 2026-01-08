import { PrismaClient, Role, AgencyType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const agency = await prisma.agency.create({
    data: {
      name: 'Test Agency',
      city: 'Addis Ababa',
      type: AgencyType.POLICE,
      isApproved: true,
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      fullName: 'Test Admin',
      email: 'admin.test@example.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const citizen = await prisma.user.create({
    data: {
      fullName: 'Test Citizen',
      email: 'citizen.test@example.com',
      passwordHash,
      role: Role.CITIZEN,
    },
  });

  await prisma.agencyStaff.create({
    data: {
      userId: admin.id,
      agencyId: agency.id,
      position: 'Dispatcher',
    },
  });

  console.log('Test seed complete:', {
    admin: admin.email,
    citizen: citizen.email,
    agency: agency.name,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
