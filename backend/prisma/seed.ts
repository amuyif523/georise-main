import {
  AgencyType,
  IncidentStatus,
  ReviewStatus,
  ResponderStatus,
  Role,
  StaffRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'password123';
const NUM_AGENCIES_PER_TYPE = 2;
const NUM_CITIZENS = 400;
const NUM_INCIDENTS = 600;
const NUM_BROADCASTS = 25;
const NUM_NOTIFICATIONS = 600;
const NUM_AUDIT_LOGS = 1000;

const rand = (() => {
  let seed = 123456789;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
})();

const randomInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const randomChoice = <T>(arr: T[]) => arr[randomInt(0, arr.length - 1)];
const randomBool = (chance = 0.5) => rand() < chance;

const chunk = <T>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const randomDateWithinDays = (days: number) => {
  const now = Date.now();
  const past = now - days * 24 * 60 * 60 * 1000;
  return new Date(randomInt(past, now));
};

const names = [
  'Amanuel',
  'Sara',
  'Mekdes',
  'Hana',
  'Samuel',
  'Natnael',
  'Rahel',
  'Yonas',
  'Biruk',
  'Ruth',
  'Michael',
  'Eden',
  'Daniel',
  'Tigist',
  'Abel',
  'Selam',
  'Yared',
  'Liya',
  'Henok',
  'Meseret',
];

const surnames = [
  'Tesfaye',
  'Abebe',
  'Bekele',
  'Kebede',
  'Mekonnen',
  'Alemu',
  'Girma',
  'Hailu',
  'Tadesse',
  'Assefa',
  'Solomon',
  'Getachew',
  'Wolde',
  'Demissie',
  'Haile',
  'Negash',
];

const categoryList = [
  'FIRE',
  'TRAFFIC',
  'MEDICAL',
  'POLICE',
  'DISASTER',
  'ELECTRIC',
  'WATER',
  'ENVIRONMENT',
  'PUBLIC_HEALTH',
  'CONSTRUCTION',
  'OTHER',
];

const incidentTitles = [
  'Smoke seen near junction',
  'Multi-vehicle collision',
  'Power line down',
  'Collapsed wall',
  'Severe injury reported',
  'Flooding in low area',
  'Suspicious activity',
  'Gas leak complaint',
  'Bus crash',
  'Fire in apartment block',
  'Medical emergency at market',
  'Road blocked by debris',
];

const subCitySeeds = [
  { name: 'Bole', lat: 9.01, lng: 38.78 },
  { name: 'Arada', lat: 9.04, lng: 38.74 },
  { name: 'Yeka', lat: 9.03, lng: 38.82 },
  { name: 'Lideta', lat: 9.01, lng: 38.73 },
  { name: 'Akaki', lat: 8.98, lng: 38.8 },
  { name: 'Gullele', lat: 9.06, lng: 38.7 },
  { name: 'Addis Ketema', lat: 9.03, lng: 38.73 },
  { name: 'Kirkos', lat: 9.01, lng: 38.76 },
  { name: 'Nifas Silk-Lafto', lat: 8.98, lng: 38.74 },
  { name: 'Kolfe Keranio', lat: 9.06, lng: 38.68 },
];

const agencyTypes = Object.values(AgencyType);

const randomLatLng = () => ({
  lat: 8.95 + rand() * 0.15,
  lng: 38.68 + rand() * 0.2,
});

const sanitizePhone = (num: number) => `+2519${num.toString().padStart(8, '0')}`;

async function createGeometries() {
  const subCities = [];
  for (const seed of subCitySeeds) {
    const subCity = await prisma.subCity.upsert({
      where: { name: seed.name },
      update: { code: seed.name.slice(0, 3).toUpperCase() },
      create: { name: seed.name, code: seed.name.slice(0, 3).toUpperCase() },
    });
    await prisma.$executeRaw`
      UPDATE "SubCity"
      SET jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${seed.lng}, ${seed.lat}), 4326)::geography, 2500)::geometry
      WHERE id = ${subCity.id};
    `;
    subCities.push({ ...subCity, lat: seed.lat, lng: seed.lng });
  }

  const woredas = [];
  let woredaIndex = 1;
  for (const subCity of subCities) {
    for (let i = 0; i < 6; i += 1) {
      const lat = subCity.lat + (rand() - 0.5) * 0.04;
      const lng = subCity.lng + (rand() - 0.5) * 0.04;
      const woreda = await prisma.woreda.create({
        data: {
          name: `${subCity.name} Woreda ${woredaIndex}`,
          code: `W${woredaIndex.toString().padStart(3, '0')}`,
          subCityId: subCity.id,
        },
      });
      await prisma.$executeRaw`
        UPDATE "Woreda"
        SET boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 1200)::geometry
        WHERE id = ${woreda.id};
      `;
      woredas.push({ ...woreda, lat, lng });
      woredaIndex += 1;
    }
  }
  return { subCities, woredas };
}

async function createAgencies(subCities: any[], woredas: any[]) {
  const agencies = [];
  let agencyIndex = 1;
  for (const type of agencyTypes) {
    for (let i = 0; i < NUM_AGENCIES_PER_TYPE; i += 1) {
      const { lat, lng } = randomLatLng();
      const subCity = randomChoice(subCities);
      const woreda = randomChoice(woredas.filter((w) => w.subCityId === subCity.id));
      const name = `${type} Response Unit ${agencyIndex}`;
      const agency = await prisma.agency.create({
        data: {
          name,
          type,
          city: subCity.name,
          description: `${type} response unit serving ${subCity.name}`,
          isApproved: true,
          isActive: true,
          subCityId: subCity.id,
          woredaId: woreda?.id ?? null,
        },
      });
      await prisma.$executeRaw`
        UPDATE "Agency"
        SET "centerLatitude" = ${lat},
            "centerLongitude" = ${lng},
            boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 1800)::geometry,
            jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 1800)::geometry
        WHERE id = ${agency.id};
      `;
      agencies.push({ ...agency, lat, lng });
      agencyIndex += 1;
    }
  }
  return agencies;
}

async function createUsers(passwordHash: string) {
  const adminEmails = ['admin@example.com', 'admin2@example.com', 'ops@example.com'];
  const admins = [];
  for (const email of adminEmails) {
    admins.push(
      await prisma.user.upsert({
        where: { email },
        update: { passwordHash, role: Role.ADMIN, isActive: true },
        create: {
          fullName: `Admin ${email.split('@')[0]}`,
          email,
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      }),
    );
  }

  const citizens = [];
  for (let i = 0; i < NUM_CITIZENS; i += 1) {
    const fullName = `${randomChoice(names)} ${randomChoice(surnames)}`;
    const email = `citizen${i + 1}@example.com`;
    const phone = sanitizePhone(90000000 + i);
    const citizen = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role: Role.CITIZEN,
        isActive: true,
        trustScore: randomInt(-2, 10),
        lastReportAt: randomBool(0.5) ? randomDateWithinDays(30) : null,
      },
    });
    citizens.push(citizen);
  }

  return { admins, citizens };
}

async function createAgencyStaffAndResponders(agencies: any[], passwordHash: string) {
  const staffUsers = [];
  const responders = [];
  let staffIndex = 1;

  for (const agency of agencies) {
    const staffCount = randomInt(8, 14);
    for (let i = 0; i < staffCount; i += 1) {
      const fullName = `${randomChoice(names)} ${randomChoice(surnames)}`;
      const email = `staff${staffIndex}@example.com`;
      const phone = sanitizePhone(91000000 + staffIndex);
      const role = Role.AGENCY_STAFF;
      const staffRole = randomChoice([
        StaffRole.DISPATCHER,
        StaffRole.RESPONDER,
        StaffRole.SUPERVISOR,
      ]);
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          role,
          isActive: true,
        },
      });
      await prisma.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId: agency.id,
          staffRole,
          position: staffRole === StaffRole.SUPERVISOR ? 'Supervisor' : 'Operator',
          isActive: true,
        },
      });
      staffUsers.push({ user, agency });

      if (randomBool(0.7)) {
        const responder = await prisma.responder.create({
          data: {
            name: `${fullName} Unit`,
            type: randomChoice(['AMBULANCE', 'TRUCK', 'PATROL', 'BIKE', 'UNIT']),
            status: randomChoice([
              ResponderStatus.AVAILABLE,
              ResponderStatus.ASSIGNED,
              ResponderStatus.EN_ROUTE,
              ResponderStatus.ON_SCENE,
              ResponderStatus.OFFLINE,
            ]),
            agencyId: agency.id,
            userId: user.id,
            latitude: agency.lat + (rand() - 0.5) * 0.02,
            longitude: agency.lng + (rand() - 0.5) * 0.02,
            lastSeenAt: randomDateWithinDays(3),
            isDemo: true,
          },
        });
        responders.push(responder);
      }
      staffIndex += 1;
    }
  }

  return { staffUsers, responders };
}

async function createSystemConfig() {
  await prisma.systemConfig.upsert({
    where: { key: 'CRISIS_MODE' },
    update: { value: 'false' },
    create: { key: 'CRISIS_MODE', value: 'false' },
  });
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

async function createAgencyJurisdictions(agencies: any[], subCities: any[], woredas: any[]) {
  const jurisdictionRows = [];
  for (const agency of agencies) {
    const picks = randomInt(1, 3);
    for (let i = 0; i < picks; i += 1) {
      if (randomBool(0.5)) {
        const subCity = randomChoice(subCities);
        jurisdictionRows.push({
          agencyId: agency.id,
          boundaryType: 'SUBCITY',
          boundaryId: subCity.id,
        });
      } else {
        const woreda = randomChoice(woredas);
        jurisdictionRows.push({
          agencyId: agency.id,
          boundaryType: 'WOREDA',
          boundaryId: woreda.id,
        });
      }
    }
  }
  for (const batch of chunk(jurisdictionRows, 200)) {
    await prisma.agencyJurisdiction.createMany({ data: batch });
  }
}

async function createIncidents(agencies: any[], citizens: any[], subCities: any[], woredas: any[]) {
  const incidents: any[] = [];
  const aiOutputs: any[] = [];
  const statusHistory: any[] = [];
  const activityLogs: any[] = [];
  const chatMessages: any[] = [];
  const photos: any[] = [];
  const shared: any[] = [];

  for (let i = 0; i < NUM_INCIDENTS; i += 1) {
    const reporter = randomChoice(citizens);
    const assignedAgency = randomBool(0.7) ? randomChoice(agencies) : null;
    const category = randomChoice(categoryList);
    const severityScore = randomInt(1, 5);
    const status = randomChoice([
      IncidentStatus.RECEIVED,
      IncidentStatus.UNDER_REVIEW,
      IncidentStatus.ASSIGNED,
      IncidentStatus.RESPONDING,
      IncidentStatus.RESOLVED,
    ]);
    const subCity = randomChoice(subCities);
    const woreda = randomChoice(woredas.filter((w) => w.subCityId === subCity.id));
    const lat = subCity.lat + (rand() - 0.5) * 0.04;
    const lng = subCity.lng + (rand() - 0.5) * 0.04;

    const incident = await prisma.incident.create({
      data: {
        title: `${randomChoice(incidentTitles)} #${i + 1}`,
        description: `Report ${i + 1}: ${category} incident reported by ${reporter.fullName}.`,
        reporterId: reporter.id,
        assignedAgencyId: assignedAgency?.id ?? null,
        category,
        severityScore,
        status,
        latitude: lat,
        longitude: lng,
        subCityId: subCity.id,
        woredaId: woreda?.id ?? null,
        reviewStatus: randomChoice([
          ReviewStatus.NOT_REQUIRED,
          ReviewStatus.PENDING_REVIEW,
          ReviewStatus.APPROVED,
          ReviewStatus.REJECTED,
        ]),
        createdAt: randomDateWithinDays(30),
      },
    });
    await prisma.$executeRaw`
      UPDATE "Incident"
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE id = ${incident.id};
    `;
    incidents.push(incident);

    if (randomBool(0.8)) {
      aiOutputs.push({
        incidentId: incident.id,
        modelVersion: 'seed-v1',
        predictedCategory: category,
        severityScore,
        confidence: Number((0.55 + rand() * 0.4).toFixed(2)),
        summary: `Seeded summary for incident ${incident.id}`,
      });
    }

    const historySteps = [
      { from: null, to: IncidentStatus.RECEIVED },
      { from: IncidentStatus.RECEIVED, to: IncidentStatus.UNDER_REVIEW },
      { from: IncidentStatus.UNDER_REVIEW, to: IncidentStatus.ASSIGNED },
      { from: IncidentStatus.ASSIGNED, to: IncidentStatus.RESPONDING },
      { from: IncidentStatus.RESPONDING, to: IncidentStatus.RESOLVED },
    ];
    const steps = randomInt(2, 5);
    for (let s = 0; s < steps; s += 1) {
      statusHistory.push({
        incidentId: incident.id,
        actorUserId: reporter.id,
        fromStatus: historySteps[s].from,
        toStatus: historySteps[s].to,
        note: `Status changed to ${historySteps[s].to}`,
        changedAt: randomDateWithinDays(30),
      });
    }

    activityLogs.push({
      incidentId: incident.id,
      userId: reporter.id,
      type: 'SYSTEM',
      message: 'Incident created via seed',
    });

    if (randomBool(0.3)) {
      const shareWith = randomChoice(agencies);
      if (shareWith) {
        shared.push({
          incidentId: incident.id,
          agencyId: shareWith.id,
          reason: randomChoice(['Backup', 'Jurisdiction overlap', 'High severity']),
        });
      }
    }

    const chatCount = randomInt(0, 3);
    for (let c = 0; c < chatCount; c += 1) {
      chatMessages.push({
        incidentId: incident.id,
        senderId: reporter.id,
        message: `Seeded chat message ${c + 1} for incident ${incident.id}`,
        createdAt: randomDateWithinDays(15),
      });
    }

    if (randomBool(0.2)) {
      photos.push({
        incidentId: incident.id,
        uploadedById: reporter.id,
        url: `/uploads/incident-photos/seed-${incident.id}.jpg`,
        storagePath: `uploads/incident-photos/seed-${incident.id}.jpg`,
        mimeType: 'image/jpeg',
        size: randomInt(25000, 250000),
        originalName: `seed-${incident.id}.jpg`,
      });
    }
  }

  for (const batch of chunk(aiOutputs, 200)) {
    await prisma.incidentAIOutput.createMany({ data: batch });
  }
  for (const batch of chunk(statusHistory, 200)) {
    await prisma.incidentStatusHistory.createMany({ data: batch });
  }
  for (const batch of chunk(activityLogs, 200)) {
    await prisma.activityLog.createMany({ data: batch });
  }
  for (const batch of chunk(chatMessages, 200)) {
    await prisma.incidentChat.createMany({ data: batch });
  }
  for (const batch of chunk(photos, 200)) {
    await prisma.incidentPhoto.createMany({ data: batch });
  }
  for (const batch of chunk(shared, 200)) {
    await prisma.sharedIncident.createMany({ data: batch, skipDuplicates: true });
  }

  return incidents;
}

async function createNotifications(users: any[]) {
  const notifications = [];
  for (let i = 0; i < NUM_NOTIFICATIONS; i += 1) {
    const user = randomChoice(users);
    notifications.push({
      userId: user.id,
      title: 'System Notice',
      message: `Notification ${i + 1} for ${user.fullName}`,
      type: randomChoice(['SYSTEM', 'PROXIMITY_ALERT', 'STATUS']),
      isRead: randomBool(0.4),
      data: { seed: true },
    });
  }
  for (const batch of chunk(notifications, 200)) {
    await prisma.notification.createMany({ data: batch });
  }
}

async function createCitizenVerification(citizens: any[]) {
  const rows = [];
  for (const citizen of citizens.slice(0, 80)) {
    rows.push({
      userId: citizen.id,
      nationalId: `ID${randomInt(100000, 999999)}`,
      phone: citizen.phone ?? sanitizePhone(92000000 + citizen.id),
      status: randomChoice(['PENDING', 'VERIFIED', 'REJECTED']),
      otpCode: randomBool(0.5) ? randomInt(100000, 999999).toString() : null,
      otpExpiresAt: randomBool(0.5) ? randomDateWithinDays(1) : null,
    });
  }
  for (const batch of chunk(rows, 200)) {
    await prisma.citizenVerification.createMany({ data: batch, skipDuplicates: true });
  }
}

async function createBroadcasts(admins: any[]) {
  const rows = [];
  for (let i = 0; i < NUM_BROADCASTS; i += 1) {
    const admin = randomChoice(admins);
    rows.push({
      message: `Broadcast message ${i + 1}`,
      sentBy: admin.id,
      sentAt: randomDateWithinDays(14),
    });
  }
  for (const batch of chunk(rows, 200)) {
    await prisma.broadcastLog.createMany({ data: batch });
  }
}

async function createAuditLogs(users: any[]) {
  const actions = [
    'CREATE_USER',
    'UPDATE_USER',
    'DEACTIVATE_USER',
    'ASSIGN_INCIDENT',
    'RESPOND_INCIDENT',
    'RESOLVE_INCIDENT',
    'REVIEW_INCIDENT',
    'SEND_BROADCAST',
    'UPDATE_SYSTEM_CONFIG',
  ];
  const logs = [];
  for (let i = 0; i < NUM_AUDIT_LOGS; i += 1) {
    const actor = randomChoice(users);
    logs.push({
      actorId: actor.id,
      action: randomChoice(actions),
      targetType: randomChoice(['User', 'Incident', 'Agency', 'SystemConfig', 'Broadcast']),
      targetId: randomBool(0.7) ? randomInt(1, 1000) : null,
      note: randomBool(0.3) ? 'Seeded audit entry' : null,
      createdAt: randomDateWithinDays(30),
    });
  }
  for (const batch of chunk(logs, 200)) {
    await prisma.auditLog.createMany({ data: batch });
  }
}

async function createPasswordResets(users: any[]) {
  const rows = [];
  for (const user of users.slice(0, 30)) {
    rows.push({
      userId: user.id,
      tokenHash: crypto.randomBytes(24).toString('hex'),
      expiresAt: randomDateWithinDays(3),
      usedAt: randomBool(0.3) ? randomDateWithinDays(2) : null,
    });
  }
  for (const batch of chunk(rows, 200)) {
    await prisma.passwordResetToken.createMany({ data: batch, skipDuplicates: true });
  }
}

async function createPushSubscriptions(users: any[]) {
  const rows = [];
  for (const user of users.slice(0, 60)) {
    rows.push({
      userId: user.id,
      endpoint: `https://push.example.com/sub/${crypto.randomUUID()}`,
      p256dh: crypto.randomBytes(16).toString('hex'),
      auth: crypto.randomBytes(12).toString('hex'),
      isActive: randomBool(0.8),
    });
  }
  for (const batch of chunk(rows, 200)) {
    await prisma.pushSubscription.createMany({ data: batch, skipDuplicates: true });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await createSystemConfig();
  const { subCities, woredas } = await createGeometries();
  const agencies = await createAgencies(subCities, woredas);
  await createDispatchRules();
  await createAgencyJurisdictions(agencies, subCities, woredas);

  const { admins, citizens } = await createUsers(passwordHash);
  const { staffUsers } = await createAgencyStaffAndResponders(agencies, passwordHash);
  const incidents = await createIncidents(agencies, citizens, subCities, woredas);

  await createCitizenVerification(citizens);
  await createNotifications([...citizens, ...admins, ...staffUsers.map((s) => s.user)]);
  await createBroadcasts(admins);
  await createAuditLogs([...citizens, ...admins, ...staffUsers.map((s) => s.user)]);
  await createPasswordResets([...citizens, ...admins, ...staffUsers.map((s) => s.user)]);
  await createPushSubscriptions([...citizens, ...staffUsers.map((s) => s.user)]);

  console.log('Seed complete', {
    agencies: agencies.length,
    subCities: subCities.length,
    woredas: woredas.length,
    citizens: citizens.length,
    staffUsers: staffUsers.length,
    incidents: incidents.length,
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
