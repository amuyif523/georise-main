import {
  AgencyType,
  IncidentStatus,
  ReviewStatus,
  ResponderStatus,
  Role,
  StaffRole,
  VerificationStatus,
  PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcrypt';
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

async function clearDatabase() {
  console.log('Clearing database...');
  // Truncate tables in specific order to avoid foreign key constraints
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations' && name !== 'spatial_ref_sys')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.log({ error });
    }
  }

  // Attempt to restore SRID 4326 if missing (recovery from previous bad seed)
  try {
    const has4326 = await prisma.$queryRaw`SELECT srid FROM spatial_ref_sys WHERE srid=4326`;
    if (Array.isArray(has4326) && has4326.length === 0) {
      console.log('Restoring SRID 4326...');
      await prisma.$executeRaw`
          INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
          VALUES (4326, 'EPSG', 4326, 
          'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]', 
          '+proj=longlat +datum=WGS84 +no_defs');
        `;
    }
  } catch (err) {
    console.warn('Could not restore SRID 4326 (might already exist or permission error)', err);
  }

  console.log('Database cleared.');
}

async function createGeometries() {
  console.log('Seeding Geometries...');
  const subCities = [
    { name: 'Bole', lat: 9.01, lng: 38.78 },
    { name: 'Arada', lat: 9.04, lng: 38.74 },
    { name: 'Yeka', lat: 9.03, lng: 38.82 },
    { name: 'Lideta', lat: 9.01, lng: 38.73 },
    { name: 'Kirkos', lat: 9.0, lng: 38.76 },
  ];

  const dbSubCities: any[] = [];

  for (const seed of subCities) {
    const subCity = await prisma.subCity.create({
      data: { name: seed.name, code: seed.name.slice(0, 3).toUpperCase() },
    });

    // Set jurisdiction buffer (approx 3km radius)
    await prisma.$executeRaw`
      UPDATE "SubCity"
      SET jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${seed.lng}, ${seed.lat}), 4326)::geography, 3000)::geometry
      WHERE id = ${subCity.id};
    `;
    dbSubCities.push({ ...subCity, lat: seed.lat, lng: seed.lng });
  }

  // Create Woredas
  const dbWoredas = [];
  for (const sc of dbSubCities) {
    for (let i = 1; i <= 3; i++) {
      const wName = `${sc.name} Woreda ${i}`;
      const w = await prisma.woreda.create({
        data: { name: wName, subCityId: sc.id, code: `${sc.code}-W${i}` },
      });

      // Offset slightly for center
      const lat = sc.lat + (i === 1 ? 0.01 : i === 2 ? -0.01 : 0);
      const lng = sc.lng + (i === 1 ? 0.01 : i === 2 ? 0 : -0.01);

      await prisma.$executeRaw`
            UPDATE "Woreda"
            SET boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 1000)::geometry
            WHERE id = ${w.id};
        `;
      dbWoredas.push({ ...w, lat, lng });
    }
  }

  return { subCities: dbSubCities };
}

async function createAgencies(subCities: any[]) {
  console.log('Seeding Agencies...');
  const bole = subCities.find((s) => s.name === 'Bole');
  const arada = subCities.find((s) => s.name === 'Arada');
  const kirkos = subCities.find((s) => s.name === 'Kirkos');

  const agenciesData = [
    {
      name: 'Addis Ababa Police Commission',
      type: AgencyType.POLICE,
      city: 'Addis Ababa',
      subCityId: arada.id,
      lat: 9.035,
      lng: 38.75,
    },
    {
      name: 'Addis Ababa Fire & Emergency',
      type: AgencyType.FIRE,
      city: 'Addis Ababa',
      subCityId: kirkos.id,
      lat: 9.015,
      lng: 38.77,
    },
    {
      name: 'Red Cross Ambulance Service',
      type: AgencyType.MEDICAL,
      city: 'Addis Ababa',
      subCityId: bole.id,
      lat: 9.005,
      lng: 38.79,
    },
    {
      name: 'Traffic Management Agency',
      type: AgencyType.TRAFFIC,
      city: 'Addis Ababa',
      subCityId: kirkos.id,
      lat: 9.01,
      lng: 38.76,
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

    await prisma.$executeRaw`
            UPDATE "Agency"
            SET "centerLatitude" = ${a.lat},
                "centerLongitude" = ${a.lng},
                boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 8000)::geometry,
                jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 8000)::geometry
            WHERE id = ${agency.id};
        `;

    // Grant full jurisdiction
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

  // 1. Super Admin
  await prisma.user.create({
    data: {
      fullName: 'Super Admin',
      email: 'admin@georise.com',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      phone: '+251911111111',
    },
  });

  // 2. Verified Citizen (Gold)
  const citizenGold = await prisma.user.create({
    data: {
      fullName: 'Dawit Mekonnen',
      email: 'dawit@gmail.com',
      passwordHash,
      role: Role.CITIZEN,
      phone: '+251922222222',
      isActive: true,
      trustScore: 450, // Gold Tier
    },
  });
  await prisma.citizenVerification.create({
    data: {
      userId: citizenGold.id,
      status: VerificationStatus.VERIFIED,
      nationalId: 'NID12345',
      phone: '+251922222222',
    },
  });

  // 3. Unverified Citizen
  await prisma.user.create({
    data: {
      fullName: 'Abebe Kebede',
      email: 'abebe@gmail.com',
      passwordHash,
      role: Role.CITIZEN,
      phone: '+251933333333',
      isActive: true,
      trustScore: 0,
    },
  });

  // 4. Agency Staff & Responders
  // Helper to find agency by type
  const findAgency = (type: AgencyType) => agencies.find((a: any) => a.type === type);

  const staffData = [
    // Dispatchers
    {
      email: 'police.admin@georise.com',
      name: 'Commander Alemu',
      type: AgencyType.POLICE,
      role: StaffRole.SUPERVISOR,
    },
    {
      email: 'police.dispatch@georise.com',
      name: 'Sgt. Berhanu',
      type: AgencyType.POLICE,
      role: StaffRole.DISPATCHER,
    },
    {
      email: 'fire.dispatch@georise.com',
      name: 'Chief Tadesse',
      type: AgencyType.FIRE,
      role: StaffRole.DISPATCHER,
    },
    {
      email: 'medic.dispatch@georise.com',
      name: 'Dr. Sara',
      type: AgencyType.MEDICAL,
      role: StaffRole.DISPATCHER,
    },

    // Police Responders
    {
      email: 'patrol1@georise.com',
      name: 'Patrol Unit Alpha',
      type: AgencyType.POLICE,
      role: StaffRole.RESPONDER,
      lat: 9.03,
      lng: 38.75,
    },
    {
      email: 'patrol2@georise.com',
      name: 'Patrol Unit Bravo',
      type: AgencyType.POLICE,
      role: StaffRole.RESPONDER,
      lat: 9.04,
      lng: 38.76,
    },
    {
      email: 'patrol3@georise.com',
      name: 'Patrol Unit Charlie',
      type: AgencyType.POLICE,
      role: StaffRole.RESPONDER,
      lat: 9.02,
      lng: 38.74,
    },

    // Fire Responders
    {
      email: 'engine1@georise.com',
      name: 'Fire Engine 1',
      type: AgencyType.FIRE,
      role: StaffRole.RESPONDER,
      lat: 9.015,
      lng: 38.77,
    },
    {
      email: 'engine2@georise.com',
      name: 'Fire Engine 2',
      type: AgencyType.FIRE,
      role: StaffRole.RESPONDER,
      lat: 9.02,
      lng: 38.78,
    },

    // Medical Responders
    {
      email: 'ambulance1@georise.com',
      name: 'Medic 1',
      type: AgencyType.MEDICAL,
      role: StaffRole.RESPONDER,
      lat: 9.005,
      lng: 38.79,
    },
    {
      email: 'ambulance2@georise.com',
      name: 'Medic 2',
      type: AgencyType.MEDICAL,
      role: StaffRole.RESPONDER,
      lat: 9.01,
      lng: 38.8,
    },
    {
      email: 'ambulance3@georise.com',
      name: 'Medic 3',
      type: AgencyType.MEDICAL,
      role: StaffRole.RESPONDER,
      lat: 9.0,
      lng: 38.78,
    },

    // Traffic Responders
    {
      email: 'traffic1@georise.com',
      name: 'Moto Unit 1',
      type: AgencyType.TRAFFIC,
      role: StaffRole.RESPONDER,
      lat: 9.01,
      lng: 38.76,
    },
  ];

  for (const acc of staffData) {
    const agency = findAgency(acc.type);
    if (!agency) continue;

    const user = await prisma.user.create({
      data: {
        fullName: acc.name,
        email: acc.email,
        passwordHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
        phone: `+2519${Math.floor(Math.random() * 100000000)}`,
      },
    });

    await prisma.agencyStaff.create({
      data: { userId: user.id, agencyId: agency.id, staffRole: acc.role },
    });

    if (acc.role === StaffRole.RESPONDER) {
      // Randomize status
      const statuses = [
        ResponderStatus.AVAILABLE,
        ResponderStatus.AVAILABLE,
        ResponderStatus.AVAILABLE,
        ResponderStatus.ASSIGNED,
        ResponderStatus.OFFLINE,
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await prisma.responder.create({
        data: {
          name: acc.name,
          type: acc.type === AgencyType.MEDICAL ? 'AMBULANCE' : 'UNIT',
          status: status,
          agencyId: agency.id,
          userId: user.id,
          latitude: acc.lat,
          longitude: acc.lng,
          lastSeenAt: new Date(),
        },
      });
    }
  }

  return { citizenGold };
}

async function createIncidents(citizen: any, subCities: any[]) {
  console.log('Seeding Incidents...');
  const activeSubCity = subCities[0];

  const incidentsData = [
    // Resolved (Past)
    {
      title: 'Minor Fender Bender',
      desc: 'Two cars scratched each other.',
      category: 'TRAFFIC',
      severity: 1,
      status: IncidentStatus.RESOLVED,
      daysAgo: 2,
    },
    {
      title: 'Dumpster Fire',
      desc: 'Fire in alleyway dumpster.',
      category: 'FIRE',
      severity: 2,
      status: IncidentStatus.RESOLVED,
      daysAgo: 5,
    },
    // Active (Recent)
    {
      title: 'Multi-Vehicle Collision',
      desc: 'Three cars involved at Bole Ring Road, heavy traffic blocked.',
      category: 'TRAFFIC',
      severity: 4,
      status: IncidentStatus.RECEIVED,
      daysAgo: 0,
    },
    {
      title: 'Building Fire',
      desc: 'Smoke seen from 4th floor of apartment complex.',
      category: 'FIRE',
      severity: 5,
      status: IncidentStatus.RECEIVED,
      daysAgo: 0,
    },
    {
      title: 'Unconscious Person',
      desc: 'Male approx 50s collapsed on sidewalk.',
      category: 'MEDICAL',
      severity: 5,
      status: IncidentStatus.ASSIGNED, // Simulate currently handled
      daysAgo: 0,
    },
    {
      title: 'Suspicious Activity',
      desc: 'Group loitering near bank entrance.',
      category: 'POLICE',
      severity: 3,
      status: IncidentStatus.RECEIVED,
      daysAgo: 0,
    },
  ];

  for (const inc of incidentsData) {
    const lat = activeSubCity.lat + (Math.random() * 0.04 - 0.02);
    const lng = activeSubCity.lng + (Math.random() * 0.04 - 0.02);

    // Date calculation
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - inc.daysAgo);

    const record = await prisma.incident.create({
      data: {
        title: inc.title,
        description: inc.desc,
        category: inc.category,
        severityScore: inc.severity,
        status: inc.status,
        reporterId: citizen.id,
        subCityId: activeSubCity.id,
        latitude: lat,
        longitude: lng,
        reviewStatus: ReviewStatus.NOT_REQUIRED,
        createdAt: createdAt,
        resolvedAt: inc.status === IncidentStatus.RESOLVED ? new Date() : null,
      },
    });

    await prisma.$executeRaw`
            UPDATE "Incident"
            SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            WHERE id = ${record.id};
        `;

    // Add AI output stub
    await prisma.incidentAIOutput.create({
      data: {
        incidentId: record.id,
        modelVersion: 'seed-v3-robust',
        predictedCategory: inc.category,
        severityScore: inc.severity,
        confidence: 0.85 + Math.random() * 0.14,
        summary: `Auto-generated summary for ${inc.title}`,
      },
    });
  }
}

async function createDispatchRules() {
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
  await clearDatabase();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const { subCities } = await createGeometries();
  const agencies = await createAgencies(subCities);
  await createDispatchRules();

  const { citizenGold } = await createUsersAndStaff(agencies, passwordHash);
  await createIncidents(citizenGold, subCities);

  console.log('------------------------------------------------');
  console.log('ROBUST SEEDING COMPLETE');
  console.log('------------------------------------------------');
  console.log('Super Admin:      admin@georise.com / password123');
  console.log('Police Admin:     police.admin@georise.com / password123');
  console.log('Police Dispatch:  police.dispatch@georise.com / password123');
  console.log('Fire Dispatch:    fire.dispatch@georise.com / password123');
  console.log('Medic Dispatch:   medic.dispatch@georise.com / password123');
  console.log('Gold Citizen:     dawit@gmail.com / password123');
  console.log('------------------------------------------------');
  console.log('Responders created: ~9 (Police, Fire, Medic, Traffic)');
  console.log('Incidents created:  6 (Mixed categories & statuses)');
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
