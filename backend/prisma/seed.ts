import {
  AgencyType,
  IncidentStatus,
  ResponderStatus,
  ReviewStatus,
  Role,
  StaffRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import prisma from '../src/prisma.js';

const ADMIN_PASSWORD = 'Admin#2026!';
const STAFF_OTP_LENGTH = 8;

const ADDIS_SUBCITIES: Array<{ name: string; code: string }> = [
  { name: 'Addis Ketema', code: 'ADD-KET' },
  { name: 'Akaky Kaliti', code: 'AKA-KAL' },
  { name: 'Arada', code: 'ARADA' },
  { name: 'Bole', code: 'BOLE' },
  { name: 'Gulele', code: 'GULLE' },
  { name: 'Kirkos', code: 'KIRKOS' },
  { name: 'Kolfe Keranio', code: 'KOL-KER' },
  { name: 'Lideta', code: 'LIDETA' },
  { name: 'Nifas Silk-Lafto', code: 'NSL' },
  { name: 'Yeka', code: 'YEKA' },
  { name: 'Lemi Kura', code: 'LEMI-KUR' },
];

const TRUNCATE_TABLES = [
  'ClassificationAudit',
  'VerificationRequest',
  'PasswordResetToken',
  'BroadcastLog',
  'SystemConfig',
  'IncidentPhoto',
  'IncidentAIOutput',
  'IncidentStatusHistory',
  'SharedIncident',
  'IncidentChat',
  'ActivityLog',
  'Incident',
  'Responder',
  'AgencyJurisdiction',
  'AgencyStaff',
  'Agency',
  'CitizenVerification',
  'Notification',
  'PushSubscription',
  'AuditLog',
  'DispatchRule',
  'Woreda',
  'SubCity',
  'User',
];

const randomAlnum = (length: number) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
    '',
  );
};

const jitterWithinRadius = (lat: number, lng: number, radiusMeters: number) => {
  const earthRadius = 6378137;
  const distance = Math.sqrt(Math.random()) * radiusMeters;
  const angle = Math.random() * 2 * Math.PI;

  const dLat = (distance * Math.cos(angle)) / earthRadius;
  const dLng = (distance * Math.sin(angle)) / (earthRadius * Math.cos((Math.PI * lat) / 180));

  return {
    latitude: lat + (dLat * 180) / Math.PI,
    longitude: lng + (dLng * 180) / Math.PI,
  };
};

async function clearDatabase() {
  console.log('--- RESETTING DATABASE (TRUNCATE ... CASCADE) ---');
  for (const tableName of TRUNCATE_TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
  }
  console.log('Database reset complete.');
}

async function main() {
  await clearDatabase();
  console.log('--- SEEDING HARDENED DEMO ENVIRONMENT ---');

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const now = new Date();

  console.log('- Seeding Addis Ababa sub-cities (11)...');
  const subCityRecords = await prisma.$transaction(
    ADDIS_SUBCITIES.map((subCity) =>
      prisma.subCity.create({
        data: {
          name: subCity.name,
          code: subCity.code,
        },
      }),
    ),
  );
  const boleSubCity = subCityRecords.find(
    (subCity: (typeof subCityRecords)[number]) => subCity.name === 'Bole',
  );
  if (!boleSubCity) {
    throw new Error('Bole sub-city must exist for demo seed.');
  }

  console.log('- Creating super admin...');
  const sysAdmin = await prisma.user.create({
    data: {
      email: 'admin@georise.com',
      fullName: 'GeoRise Systems Administrator',
      phone: '+251911000000',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
      isVerified: true,
      trustScore: 100,
      citizenVerification: {
        create: {
          nationalId: 'SYSTEM-AUTO',
          status: 'VERIFIED',
          phone: '+251911000000',
          verifiedAt: now,
        },
      },
    },
  });

  console.log('- Creating Bole prototype agency...');
  const boleAgency = await prisma.agency.create({
    data: {
      name: 'Bole District Command Center',
      type: AgencyType.POLICE,
      city: 'Addis Ababa',
      description: 'Primary rapid response prototype node for Bole sub-city.',
      centerLatitude: 9.0,
      centerLongitude: 38.785,
      subCityId: boleSubCity.id,
      isActive: true,
      isApproved: true,
    },
  });

  console.log('- Creating vetted agency manager + responders...');
  const managerOtp = randomAlnum(STAFF_OTP_LENGTH);
  const managerOtpHash = await bcrypt.hash(managerOtp, 10);

  const boleManager = await prisma.user.create({
    data: {
      email: 'manager.bole@georise.com',
      fullName: 'Commander Hana Bekele',
      phone: '+251911000001',
      passwordHash: managerOtpHash,
      role: Role.AGENCY_MANAGER,
      isActive: true,
      mustChangePassword: true,
      isVerified: true,
      trustScore: 50,
      citizenVerification: {
        create: {
          nationalId: 'SYSTEM-AUTO',
          status: 'VERIFIED',
          phone: '+251911000001',
          verifiedAt: now,
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

  const responderSeeds = [
    {
      callsign: 'Bole-Alpha',
      fullName: 'Officer Bole-Alpha',
      email: 'bole-alpha@georise.com',
      phone: '+251911000002',
    },
    {
      callsign: 'Bole-Bravo',
      fullName: 'Officer Bole-Bravo',
      email: 'bole-bravo@georise.com',
      phone: '+251911000003',
    },
  ];

  const responderOtps: Array<{ email: string; otp: string }> = [];

  for (const responderSeed of responderSeeds) {
    const otp = randomAlnum(STAFF_OTP_LENGTH);
    responderOtps.push({ email: responderSeed.email, otp });
    const otpHash = await bcrypt.hash(otp, 10);

    const user = await prisma.user.create({
      data: {
        email: responderSeed.email,
        fullName: responderSeed.fullName,
        phone: responderSeed.phone,
        passwordHash: otpHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
        mustChangePassword: true,
        isVerified: true,
        trustScore: 50,
        citizenVerification: {
          create: {
            nationalId: 'SYSTEM-AUTO',
            status: 'VERIFIED',
            phone: responderSeed.phone,
            verifiedAt: now,
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

    const jittered = jitterWithinRadius(boleAgency.centerLatitude, boleAgency.centerLongitude, 500);

    await prisma.responder.create({
      data: {
        name: responderSeed.callsign,
        type: 'General',
        agencyId: boleAgency.id,
        userId: user.id,
        status: ResponderStatus.STANDBY,
        subCityId: boleSubCity.id,
        latitude: jittered.latitude,
        longitude: jittered.longitude,
        breadcrumbs: [[jittered.longitude, jittered.latitude]],
        isActive: true,
      },
    });
  }

  console.log('- Seeding active Bole incidents...');
  // NOTE: Current schema does not include IncidentStatus.PENDING; RECEIVED is used as pending intake state.
  const incidents = await prisma.$transaction([
    prisma.incident.create({
      data: {
        title: 'Structural Fire - Bole Atlas Axis',
        description: 'Smoke and flames reported from a mixed-use building near Atlas junction.',
        category: 'FIRE',
        severityScore: 5,
        status: IncidentStatus.RECEIVED,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
        latitude: 8.9974,
        longitude: 38.7852,
        subCityId: boleSubCity.id,
        assignedAgencyId: boleAgency.id,
        reportedAt: now,
        isDemo: true,
        demoScenarioCode: 'DEMO-BOLE-FIRE',
      },
    }),
    prisma.incident.create({
      data: {
        title: 'Street Crime - Bole Medhanealem',
        description: 'Coordinated theft incident reported by multiple witnesses at night.',
        category: 'CRIME',
        severityScore: 4,
        status: IncidentStatus.RECEIVED,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
        latitude: 8.9986,
        longitude: 38.7881,
        subCityId: boleSubCity.id,
        assignedAgencyId: boleAgency.id,
        reportedAt: now,
        isDemo: true,
        demoScenarioCode: 'DEMO-BOLE-CRIME',
      },
    }),
    prisma.incident.create({
      data: {
        title: 'Multi-vehicle Collision - Bole Ring Road',
        description: 'Three-vehicle crash blocking key traffic lane with injuries reported.',
        category: 'TRAFFIC',
        severityScore: 3,
        status: IncidentStatus.RECEIVED,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
        latitude: 9.0012,
        longitude: 38.7824,
        subCityId: boleSubCity.id,
        assignedAgencyId: boleAgency.id,
        reportedAt: now,
        isDemo: true,
        demoScenarioCode: 'DEMO-BOLE-TRAFFIC',
      },
    }),
  ]);

  await prisma.incidentPhoto.create({
    data: {
      incidentId: incidents[0].id,
      uploadedById: boleManager.id,
      url: '/uploads/incident-photos/demo-bole-structural-fire.jpg',
      storagePath: 'uploads/incident-photos/demo-bole-structural-fire.jpg',
      mimeType: 'image/jpeg',
      size: 245760,
      originalName: 'demo-bole-structural-fire.jpg',
    },
  });

  console.log('--- SEED COMPLETE ---');
  console.log(`Admin Login: admin@georise.com / ${ADMIN_PASSWORD}`);
  console.log(`Manager OTP (must change): manager.bole@georise.com / ${managerOtp}`);
  responderOtps.forEach((entry) => {
    console.log(`Responder OTP (must change): ${entry.email} / ${entry.otp}`);
  });
  console.log(`Seeded ${ADDIS_SUBCITIES.length} Addis sub-cities, 1 agency, 3 active demo incidents.`);
  console.log(`Super admin ID: ${sysAdmin.id}`);
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
