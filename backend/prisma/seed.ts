import { Role, StaffRole, AgencyType, ResponderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import prisma from '../src/prisma';

const SEED_PASSWORD = 'password123';

async function clearDatabase() {
  console.log('--- CLEARING DATABASE (TRUNCATE CASCADE) ---');
  const tableNames = [
    'ActivityLog', 'IncidentAIOutput', 'IncidentPhoto', 'IncidentStatusHistory',
    'SharedIncident', 'Incident', 'Responder', 'AuditLog', 'PasswordResetToken',
    'IncidentChat', 'PushSubscription', 'Notification', 'CitizenVerification',
    'AgencyStaff', 'AgencyJurisdiction', 'Agency', 'DispatchRule', 'Woreda',
    'SubCity', 'User',
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

  // 1. Seed Addis Ababa Sub-Cities
  console.log('- Seeding Addis Ababa Sub-Cities...');
  const subCitiesData = [
    { name: 'Bole', code: 'BOL' },
    { name: 'Nifas Silk-Lafto', code: 'NSL' },
    { name: 'Arada', code: 'ARA' },
    { name: 'Kirkos', code: 'KIR' },
    { name: 'Yeka', code: 'YEK' },
  ];

  const subCityRecords = [];
  for (const sc of subCitiesData) {
    const record = await prisma.subCity.create({ 
      data: {
        name: sc.name,
        code: sc.code
      } 
    });
    subCityRecords.push(record);
  }
  const boleSubCity = subCityRecords.find(s => s.name === 'Bole')!;

  // 2. Super Admin
  const sysAdmin = await prisma.user.create({
    data: {
      email: 'admin@georise.com',
      fullName: 'GeoRise Systems Administrator',
      phone: '+251911000000',
      passwordHash: passwordHash,
      role: Role.ADMIN,
      isActive: true,
      trustScore: 100,
      citizenVerification: {
        create: {
          nationalId: 'V-ADMIN',
          status: 'VERIFIED',
          phone: '+251911000000',
        },
      },
    },
  });

  // 3. Bole Agency (Added 'city' and 'description')
  const boleAgency = await prisma.agency.create({
    data: {
      name: 'Bole District Command Center',
      type: AgencyType.POLICE,
      city: 'Addis Ababa',
      description: 'Primary rapid response node for Bole sub-city.',
      centerLatitude: 9.000,
      centerLongitude: 38.785,
      subCityId: boleSubCity.id,
      isActive: true,
      isApproved: true,
    },
  });

  // 4. Agency Manager for Bole
  const boleManager = await prisma.user.create({
    data: {
      email: 'manager.bole@georise.com',
      fullName: 'Bole Agency Manager',
      phone: '+251911000001',
      passwordHash: passwordHash,
      role: Role.AGENCY_MANAGER,
      isActive: true,
      trustScore: 50,
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
    },
  });

  // 5. Responders (With Jitter)
  const responderNames = ['Bole-Alpha', 'Bole-Bravo'];
  let phoneCounter = 2;

  for (const rName of responderNames) {
    const user = await prisma.user.create({
      data: {
        email: `${rName.toLowerCase()}@georise.com`,
        fullName: `Officer ${rName}`,
        passwordHash: passwordHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
        trustScore: 50,
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
      },
    });

    const jitterLat = boleAgency.centerLatitude + (Math.random() - 0.5) * 0.01;
    const jitterLng = boleAgency.centerLongitude + (Math.random() - 0.5) * 0.01;

    await prisma.responder.create({
      data: {
        name: user.fullName,
        type: 'UNIT',
        agencyId: boleAgency.id,
        userId: user.id,
        status: ResponderStatus.STANDBY,
        subCityId: boleSubCity.id,
        latitude: jitterLat,
        longitude: jitterLng,
        isActive: true,
      },
    });
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