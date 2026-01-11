import bcrypt from 'bcrypt';
import prisma from '../src/prisma';
import { Role, StaffRole } from '@prisma/client';

const adminEmail = process.env.ADMIN_EMAIL || 'admin_load@example.com';
const agencyEmail = process.env.AGENCY_EMAIL || 'agency_load@example.com';
const citizenEmail = process.env.CITIZEN_EMAIL || 'citizen_load@example.com';
const password = process.env.LOAD_PASSWORD || 'loadpass123';

async function run() {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: Role.ADMIN, isActive: true },
    create: {
      fullName: 'Load Admin',
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  let agency = await prisma.agency.findFirst({
    where: { name: 'Load Test Agency' },
  });

  if (!agency) {
    agency = await prisma.agency.create({
      data: {
        name: 'Load Test Agency',
        type: 'POLICE',
        city: 'Addis Ababa',
        description: 'Seeded for load testing',
        isActive: true,
        isApproved: true,
      },
    });
  } else {
    agency = await prisma.agency.update({
      where: { id: agency.id },
      data: { isActive: true, isApproved: true },
    });
  }

  const staff = await prisma.user.upsert({
    where: { email: agencyEmail },
    update: { passwordHash, role: Role.AGENCY_STAFF, isActive: true },
    create: {
      fullName: 'Load Agency Staff',
      email: agencyEmail,
      passwordHash,
      role: Role.AGENCY_STAFF,
      isActive: true,
    },
  });

  await prisma.agencyStaff.upsert({
    where: { userId: staff.id },
    update: { agencyId: agency.id, staffRole: StaffRole.DISPATCHER, isActive: true },
    create: {
      userId: staff.id,
      agencyId: agency.id,
      staffRole: StaffRole.DISPATCHER,
      isActive: true,
    },
  });

  const citizen = await prisma.user.upsert({
    where: { email: citizenEmail },
    update: { passwordHash, role: Role.CITIZEN, isActive: true },
    create: {
      fullName: 'Load Citizen',
      email: citizenEmail,
      passwordHash,
      role: Role.CITIZEN,
      isActive: true,
    },
  });

  await prisma.incident.create({
    data: {
      title: 'Load test incident',
      description: 'Seeded incident for load testing timeline.',
      reporterId: citizen.id,
      assignedAgencyId: agency.id,
      status: 'ASSIGNED',
    },
  });

  console.log('Seeded load users:', { admin: adminEmail, agency: agencyEmail, password });
}

run()
  .catch((err) => {
    console.error('Seed load users failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
