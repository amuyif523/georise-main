import {
  AgencyType,
  IncidentStatus,
  ReviewStatus,
  ResponderStatus,
  Role,
  StaffRole,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const SEED_PASSWORD = 'password123';

// Helper for geometries

async function createGeometries() {
  console.log('Seeding Geometries...');
  const subCities = [
    { name: 'Bole', lat: 9.01, lng: 38.78 },
    { name: 'Arada', lat: 9.04, lng: 38.74 },
    { name: 'Yeka', lat: 9.03, lng: 38.82 },
    { name: 'Lideta', lat: 9.01, lng: 38.73 },
  ];

  const dbSubCities = [];

  for (const seed of subCities) {
    const subCity = await prisma.subCity.upsert({
      where: { name: seed.name },
      update: { code: seed.name.slice(0, 3).toUpperCase() },
      create: { name: seed.name, code: seed.name.slice(0, 3).toUpperCase() },
    });

    // Set simplified jurisdiction buffer
    await prisma.$executeRaw`
      UPDATE "SubCity"
      SET jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${seed.lng}, ${seed.lat}), 4326)::geography, 3000)::geometry
      WHERE id = ${subCity.id};
    `;
    dbSubCities.push({ ...subCity, lat: seed.lat, lng: seed.lng });
  }

  // Create a few Woredas per SubCity
  const dbWoredas = [];
  for (const sc of dbSubCities) {
    for (let i = 1; i <= 2; i++) {
      const wName = `${sc.name} Woreda ${i}`;
      const w = await prisma.woreda.upsert({
        where: { subCityId_name: { subCityId: sc.id, name: wName } },
        update: {},
        create: { name: wName, subCityId: sc.id, code: `${sc.code}-W${i}` },
      });

      // Offset slightly for center
      const lat = sc.lat + (i === 1 ? 0.01 : -0.01);
      const lng = sc.lng + (i === 1 ? 0.01 : -0.01);

      await prisma.$executeRaw`
            UPDATE "Woreda"
            SET boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 1000)::geometry
            WHERE id = ${w.id};
        `;
      dbWoredas.push({ ...w, lat, lng });
    }
  }

  return { subCities: dbSubCities, woredas: dbWoredas };
}

async function createDeterministicAgencies(subCities: any[]) {
  console.log('Seeding Agencies...');
  const bole = subCities.find((s) => s.name === 'Bole') || subCities[0];
  const arada = subCities.find((s) => s.name === 'Arada') || subCities[0];

  const agenciesData = [
    {
      name: 'Central Police HQ',
      type: AgencyType.POLICE,
      city: 'Addis Ababa',
      subCityId: arada.id,
      lat: arada.lat,
      lng: arada.lng,
    },
    {
      name: 'Addis Fire & Rescue',
      type: AgencyType.FIRE,
      city: 'Addis Ababa',
      subCityId: bole.id,
      lat: bole.lat,
      lng: bole.lng,
    },
    {
      name: 'Tikur Anbessa Ambulance',
      type: AgencyType.MEDICAL,
      city: 'Addis Ababa',
      subCityId: arada.id,
      lat: arada.lat - 0.005,
      lng: arada.lng + 0.005,
    },
    {
      name: 'Traffic Management Center',
      type: AgencyType.TRAFFIC,
      city: 'Addis Ababa',
      subCityId: bole.id,
      lat: bole.lat + 0.005,
      lng: bole.lng - 0.005,
    },
  ];

  const dbAgencies = [];

  for (const a of agenciesData) {
    const agency = await prisma.agency.create({
      data: {
        name: a.name,
        type: a.type,
        city: a.city,
        subCityId: a.subCityId,
        isApproved: true,
        isActive: true,
      },
    });

    // Set location
    await prisma.$executeRaw`
            UPDATE "Agency"
            SET "centerLatitude" = ${a.lat},
                "centerLongitude" = ${a.lng},
                boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 5000)::geometry,
                jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 5000)::geometry
            WHERE id = ${agency.id};
        `;

    // Give them jurisdiction over ALL subcities for simplicity in this demo
    for (const sc of subCities) {
      await prisma.agencyJurisdiction.create({
        data: {
          agencyId: agency.id,
          boundaryType: 'SUBCITY',
          boundaryId: sc.id,
        },
      });
    }

    dbAgencies.push(agency);
  }
  return dbAgencies;
}

async function createUsersAndStaff(agencies: any[], passwordHash: string) {
  console.log('Seeding Users & Staff...');

  // 1. Admin
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, role: Role.ADMIN, isActive: true },
    create: {
      fullName: 'System Admin',
      email: 'admin@example.com',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // 2. Citizen
  const citizen = await prisma.user.upsert({
    where: { email: 'citizen@georise.com' },
    update: { passwordHash, role: Role.CITIZEN, isActive: true },
    create: {
      fullName: 'Abebe Bikila',
      email: 'citizen@georise.com',
      passwordHash,
      role: Role.CITIZEN,
      phone: '+251911000000',
      isActive: true,
      trustScore: 100, // High trust for testing
    },
  });

  // Verify the citizen separately
  await prisma.citizenVerification.upsert({
    where: { userId: citizen.id },
    create: {
      userId: citizen.id,
      status: VerificationStatus.VERIFIED,
      nationalId: '123456789',
      phone: '+251911000000',
    },
    update: {
      status: VerificationStatus.VERIFIED,
      nationalId: '123456789',
    },
  });

  // 3. Agency Staff
  // Helper to find agency by type
  const findAgency = (type: AgencyType) => agencies.find((a: any) => a.type === type);

  const staffAccounts = [
    {
      email: 'police@georise.com',
      name: 'Police Dispatcher',
      type: AgencyType.POLICE,
      role: StaffRole.DISPATCHER,
    },
    {
      email: 'fire@georise.com',
      name: 'Fire Dispatcher',
      type: AgencyType.FIRE,
      role: StaffRole.DISPATCHER,
    },
    {
      email: 'medic@georise.com',
      name: 'Ambulance Dispatcher',
      type: AgencyType.MEDICAL,
      role: StaffRole.DISPATCHER,
    },
    {
      email: 'traffic@georise.com',
      name: 'Traffic Officer',
      type: AgencyType.TRAFFIC,
      role: StaffRole.DISPATCHER,
    },
    // Responders
    {
      email: 'police_unit@georise.com',
      name: 'Patrol Unit 1',
      type: AgencyType.POLICE,
      role: StaffRole.RESPONDER,
    },
    {
      email: 'fire_unit@georise.com',
      name: 'Engine 1',
      type: AgencyType.FIRE,
      role: StaffRole.RESPONDER,
    },
    {
      email: 'medic_unit@georise.com',
      name: 'Ambulance 1',
      type: AgencyType.MEDICAL,
      role: StaffRole.RESPONDER,
    },
  ];

  for (const acc of staffAccounts) {
    const agency = findAgency(acc.type);
    if (!agency) continue;

    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash, role: Role.AGENCY_STAFF, isActive: true },
      create: {
        fullName: acc.name,
        email: acc.email,
        passwordHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
        phone: `+2519${Math.floor(Math.random() * 100000000)}`,
      },
    });

    await prisma.agencyStaff.upsert({
      where: { userId: user.id },
      update: { agencyId: agency.id, staffRole: acc.role },
      create: { userId: user.id, agencyId: agency.id, staffRole: acc.role },
    });

    // Create Responder profile if needed
    if (acc.role === StaffRole.RESPONDER) {
      const exist = await prisma.responder.findFirst({ where: { userId: user.id } });
      if (!exist) {
        await prisma.responder.create({
          data: {
            name: acc.name,
            type: acc.type === AgencyType.MEDICAL ? 'AMBULANCE' : 'UNIT',
            status: ResponderStatus.AVAILABLE,
            agencyId: agency.id,
            userId: user.id,
            // Place them near agency center
            latitude: 9.03,
            longitude: 38.74,
            lastSeenAt: new Date(),
          },
        });
      }
    }
  }

  return { citizen };
}

async function createSampleIncidents(citizen: any, subCities: any[]) {
  console.log('Seeding Sample Incidents...');
  const bole = subCities.find((s) => s.name === 'Bole');

  const incidentsData = [
    {
      title: 'House Fire in Bole',
      desc: 'Large fire visible from main road, black smoke.',
      category: 'FIRE',
      severity: 4,
      lat: bole.lat + 0.002,
      lng: bole.lng + 0.002,
    },
    {
      title: 'Car Accident at Junction',
      desc: 'Two cars collided, blocking traffic. No severe injuries visible.',
      category: 'TRAFFIC',
      severity: 2,
      lat: bole.lat - 0.002,
      lng: bole.lng - 0.002,
    },
    {
      title: 'Heart Attack Suspected',
      desc: 'Older man collapsed near the cafe.',
      category: 'MEDICAL',
      severity: 5,
      lat: bole.lat,
      lng: bole.lng,
    },
  ];

  for (const inc of incidentsData) {
    const record = await prisma.incident.create({
      data: {
        title: inc.title,
        description: inc.desc,
        category: inc.category,
        severityScore: inc.severity,
        status: IncidentStatus.RECEIVED,
        reporterId: citizen.id,
        subCityId: bole.id,
        latitude: inc.lat,
        longitude: inc.lng,
        reviewStatus: ReviewStatus.NOT_REQUIRED, // Auto-validate for demo
      },
    });

    await prisma.$executeRaw`
            UPDATE "Incident"
            SET location = ST_SetSRID(ST_MakePoint(${inc.lng}, ${inc.lat}), 4326)
            WHERE id = ${record.id};
        `;

    // Add AI output stub
    await prisma.incidentAIOutput.create({
      data: {
        incidentId: record.id,
        modelVersion: 'seed-v2',
        predictedCategory: inc.category,
        severityScore: inc.severity,
        confidence: 0.95,
        summary: 'Auto-generated seed summary',
      },
    });
  }
}

async function createDispatchRules() {
  await prisma.dispatchRule.deleteMany();
  await prisma.dispatchRule.createMany({
    data: [
      { category: 'FIRE', defaultAgencyType: AgencyType.FIRE },
      { category: 'TRAFFIC', defaultAgencyType: AgencyType.TRAFFIC },
      { category: 'MEDICAL', defaultAgencyType: AgencyType.MEDICAL },
      { category: 'POLICE', defaultAgencyType: AgencyType.POLICE },
      { category: 'DISASTER', defaultAgencyType: AgencyType.DISASTER },
      { category: 'ELECTRIC', defaultAgencyType: AgencyType.ELECTRIC },
      { category: 'WATER', defaultAgencyType: AgencyType.WATER },
    ],
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const { subCities } = await createGeometries();
  const agencies = await createDeterministicAgencies(subCities);
  await createDispatchRules();

  const { citizen } = await createUsersAndStaff(agencies, passwordHash);
  await createSampleIncidents(citizen, subCities);

  console.log('Deterministic Seeding Complete!');
  console.log('------------------------------------------------');
  console.log('Admin:   admin@example.com / password123');
  console.log('Citizen: citizen@georise.com / password123');
  console.log('Police:  police@georise.com (Dispatcher)');
  console.log('Fire:    fire@georise.com (Dispatcher)');
  console.log('Medic:   medic@georise.com (Dispatcher)');
  console.log('------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
