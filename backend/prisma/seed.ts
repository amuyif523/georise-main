import { Role, StaffRole, AgencyType } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import prisma from '../src/prisma';

const SEED_PASSWORD = 'password123';

async function clearDatabase() {
  console.log('--- CLEARING DATABASE (TRUNCATE CASCADE) ---');
  // Use raw SQL to truncate all tables safely ignoring foreign keys during the operation
  const tableNames = [
    'ActivityLog',
    'IncidentAIOutput',
    'IncidentPhoto',
    'IncidentStatusHistory',
    'SharedIncident',
    'Incident',
    'Responder',
    'AuditLog',
    'PasswordResetToken',
    'IncidentChat',
    'PushSubscription',
    'Notification',
    'CitizenVerification',
    'AgencyStaff',
    'AgencyJurisdiction',
    'Agency',
    'DispatchRule',
    'Woreda',
    'SubCity',
    'User',
  ];

  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
  }
  console.log('Database cleared completely.');
}

async function main() {
  await clearDatabase();
  console.log('--- SEEDING NEW ENVIRONMENT ---');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // 1. Super Admin
  const sysAdmin = await prisma.user.create({
    data: {
      email: 'admin@georise.com',
      fullName: 'GeoRise Systems Administrator',
      phone: '+251911000000',
      passwordHash: passwordHash,
      role: Role.ADMIN,
      trustScore: 100, // Trust Score: 100 for admin
      isActive: true,
      deletedAt: null,
      citizenVerification: {
        create: {
          nationalId: 'V-ADMIN',
          status: 'VERIFIED',
          phone: '+251911000000',
        },
      },
    },
  });
  console.log(`- Created Main Admin: ${sysAdmin.email}`);

  // 2. Bole Agency
  const boleAgency = await prisma.agency.create({
    data: {
      name: 'Bole District Command Center',
      type: AgencyType.POLICE,
      city: 'Addis Ababa',
      description: 'Primary rapid response node for Bole sub-city.',
      isApproved: true,
      isActive: true,
      deletedAt: null,
      centerLatitude: 9.0,
      centerLongitude: 38.785,
    },
  });
  console.log(`- Created Agency: ${boleAgency.name} at [9.0000, 38.7850]`);

  // 3. Agency Manager for Bole
  const boleManager = await prisma.user.create({
    data: {
      email: 'manager.bole@georise.com',
      fullName: 'Bole Agency Manager',
      phone: '+251911000001',
      passwordHash: passwordHash,
      role: Role.AGENCY_MANAGER,
      trustScore: 50,
      isActive: true,
      deletedAt: null,
      citizenVerification: {
        create: {
          nationalId: 'V-MANAGER-BOLE',
          status: 'VERIFIED',
          phone: '+251911000001',
        },
      },
    },
  });

  await prisma.agencyStaff.create({
    data: {
      userId: boleManager.id,
      agencyId: boleAgency.id,
      staffRole: StaffRole.MANAGER,
      isActive: true,
      deactivatedAt: null,
    },
  });
  console.log(`- Created Agency Manager: ${boleManager.email}`);

  // 4. Responders
  const responderNames = ['Bole-Alpha', 'Bole-Bravo', 'Bole-Charlie'];
  let phoneCounter = 2;
  for (const rName of responderNames) {
    const userHash = await bcrypt.hash(`${rName.toLowerCase()}123`, 10);
    const user = await prisma.user.create({
      data: {
        email: `${rName.toLowerCase()}@georise.com`,
        fullName: `Officer ${rName}`,
        passwordHash: userHash,
        role: Role.AGENCY_STAFF,
        trustScore: 50,
        isActive: true,
        deletedAt: null,
        citizenVerification: {
          create: {
            nationalId: `V-${rName.toUpperCase()}`,
            status: 'VERIFIED',
            phone: `+25191100000${phoneCounter++}`,
          },
        },
      },
    });

    await prisma.agencyStaff.create({
      data: {
        userId: user.id,
        agencyId: boleAgency.id,
        staffRole: StaffRole.RESPONDER,
        isActive: true,
        deactivatedAt: null,
      },
    });

    await prisma.responder.create({
      data: {
        name: user.fullName,
        type: 'UNIT',
        agencyId: boleAgency.id,
        userId: user.id,
        status: 'AVAILABLE',
        isActive: true,
        deletedAt: null,
        latitude: 9.0,
        longitude: 38.785,
        // @ts-ignore - Prisma JSON array syntax bypass for breadcrumbs
        breadcrumbs: [[38.785, 9.0]],
      },
    });
    console.log(`- Created Responder Unit: ${rName} at [9.0000, 38.7850]`);
  }

  console.log('--- SEED COMPLETE ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
