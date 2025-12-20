import prisma from '../../prisma';

const DEMO_CODE = 'ADDIS_SCENARIO_1';

const subMinutes = (date: Date, mins: number) => new Date(date.getTime() - mins * 60000);
const addMinutes = (date: Date, mins: number) => new Date(date.getTime() + mins * 60000);

export class DemoService {
  async resetDemoData() {
    await prisma.activityLog.deleteMany({ where: { incident: { isDemo: true } } });
    await prisma.incidentStatusHistory.deleteMany({ where: { incident: { isDemo: true } } });
    await prisma.incidentAIOutput.deleteMany({ where: { incident: { isDemo: true } } });
    await prisma.incident.deleteMany({ where: { isDemo: true } });
    await prisma.responder.deleteMany({ where: { isDemo: true } });
  }

  async seedAddisScenario1() {
    await this.resetDemoData();
    const now = new Date();

    const [police, fire, medical] = await Promise.all([
      this.ensureAgency('Addis Ababa Police', 'POLICE'),
      this.ensureAgency('Addis Fire & Emergency', 'FIRE'),
      this.ensureAgency('Addis Medical / Ambulance', 'MEDICAL'),
    ]);

    await prisma.responder.createMany({
      data: [
        {
          agencyId: police.id,
          name: 'Police Unit P-1',
          type: 'PATROL',
          latitude: 9.01,
          longitude: 38.74,
          lastSeenAt: subMinutes(now, 5),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
        {
          agencyId: police.id,
          name: 'Police Unit P-2',
          type: 'PATROL',
          latitude: 9.02,
          longitude: 38.75,
          lastSeenAt: subMinutes(now, 3),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
        {
          agencyId: fire.id,
          name: 'Fire Truck F-1',
          type: 'FIRE_TRUCK',
          latitude: 9.0,
          longitude: 38.76,
          lastSeenAt: subMinutes(now, 7),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
        {
          agencyId: fire.id,
          name: 'Fire Truck F-2',
          type: 'FIRE_TRUCK',
          latitude: 8.995,
          longitude: 38.77,
          lastSeenAt: subMinutes(now, 12),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
        {
          agencyId: medical.id,
          name: 'Ambulance M-1',
          type: 'AMBULANCE',
          latitude: 9.015,
          longitude: 38.755,
          lastSeenAt: subMinutes(now, 4),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
        {
          agencyId: medical.id,
          name: 'Ambulance M-2',
          type: 'AMBULANCE',
          latitude: 9.025,
          longitude: 38.745,
          lastSeenAt: subMinutes(now, 2),
          isDemo: true,
          demoScenarioCode: DEMO_CODE,
        },
      ],
    });

    const units = await prisma.responder.findMany({
      where: { isDemo: true, demoScenarioCode: DEMO_CODE },
    });
    const policeUnit = units.find((u) => u.agencyId === police.id)!;
    const fireUnit = units.find((u) => u.agencyId === fire.id)!;
    const medicalUnit = units.find((u) => u.agencyId === medical.id)!;
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    const incidentsData = [
      {
        title: 'Vehicle collision near Mexico Square',
        description: 'Two-car collision blocking lane. Possible injuries.',
        category: 'TRAFFIC',
        severityScore: 4,
        lat: 9.01,
        lon: 38.74,
        minutesAgo: 50,
        agency: police,
        unit: policeUnit,
        statuses: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED', 'RESPONDING', 'RESOLVED'],
      },
      {
        title: 'Building fire in Bole',
        description: 'Smoke visible from 3rd floor apartment near Bole Medhanealem.',
        category: 'FIRE',
        severityScore: 5,
        lat: 8.995,
        lon: 38.78,
        minutesAgo: 40,
        agency: fire,
        unit: fireUnit,
        statuses: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED', 'RESPONDING', 'RESOLVED'],
      },
      {
        title: 'Medical emergency in Piassa',
        description: 'Unconscious person on sidewalk near Piassa.',
        category: 'MEDICAL',
        severityScore: 5,
        lat: 9.035,
        lon: 38.74,
        minutesAgo: 30,
        agency: medical,
        unit: medicalUnit,
        statuses: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED', 'RESPONDING'],
      },
      {
        title: 'Electric cable down in Merkato',
        description: 'Live wire suspected on street, possible electrocution risk.',
        category: 'ELECTRIC',
        severityScore: 4,
        lat: 9.03,
        lon: 38.71,
        minutesAgo: 20,
        agency: fire,
        unit: fireUnit,
        statuses: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED'],
      },
      {
        title: 'Crowd disturbance near Stadium',
        description: 'Large crowd arguing, risk of escalation.',
        category: 'CRIME',
        severityScore: 3,
        lat: 9.02,
        lon: 38.77,
        minutesAgo: 15,
        agency: police,
        unit: policeUnit,
        statuses: ['RECEIVED', 'UNDER_REVIEW'],
      },
      {
        title: 'Minor accident in Sarbet',
        description: 'Motorcycle fall, minor injuries, traffic still moving.',
        category: 'TRAFFIC',
        severityScore: 2,
        lat: 9.0,
        lon: 38.72,
        minutesAgo: 10,
        agency: police,
        unit: policeUnit,
        statuses: ['RECEIVED'],
      },
    ];

    for (const item of incidentsData) {
      await this.createDemoIncident(item, now, adminUser);
    }

    return { scenario: DEMO_CODE, incidents: incidentsData.length, units: units.length };
  }

  private async createDemoIncident(
    params: {
      title: string;
      description: string;
      category: string;
      severityScore: number;
      lat: number;
      lon: number;
      minutesAgo: number;
      agency: any;
      unit: any;
      statuses: string[];
    },
    now: Date,
    adminUser: any,
  ) {
    const createdAt = subMinutes(now, params.minutesAgo);
    const locationWkt = `SRID=4326;POINT(${params.lon} ${params.lat})`;
    const reporter = await this.ensureDemoCitizen();

    const assignedAt = addMinutes(createdAt, 5);
    const arrivedAt =
      params.statuses.includes('RESPONDING') || params.statuses.includes('RESOLVED')
        ? addMinutes(createdAt, 15)
        : null;
    const resolvedAt = params.statuses.includes('RESOLVED') ? addMinutes(createdAt, 35) : null;

    const assignedResponderId =
      params.statuses.includes('ASSIGNED') ||
      params.statuses.includes('RESPONDING') ||
      params.statuses.includes('RESOLVED')
        ? params.unit.id
        : 'NULL';
    const dispatchedAtVal = params.statuses.includes('ASSIGNED')
      ? `'${assignedAt.toISOString()}'`
      : 'NULL';
    const arrivedAtVal = arrivedAt ? `'${arrivedAt.toISOString()}'` : 'NULL';
    const resolvedAtVal = resolvedAt ? `'${resolvedAt.toISOString()}'` : 'NULL';

    const incidentRows: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "Incident"
        ("reporterId","assignedAgencyId","assignedResponderId","title","description","category",
         "severityScore","status","location","createdAt","updatedAt","isDemo","demoScenarioCode",
         "dispatchedAt", "arrivalAt", "resolvedAt")
      VALUES
        (${reporter.id}, ${params.agency.id}, ${assignedResponderId}, '${params.title.replace(/'/g, "''")}',
         '${params.description.replace(/'/g, "''")}', '${params.category}',
         ${params.severityScore}, '${params.statuses[params.statuses.length - 1]}',
         ST_GeomFromText('${locationWkt}'),
         '${createdAt.toISOString()}', '${now.toISOString()}', true, '${DEMO_CODE}',
         ${dispatchedAtVal}, ${arrivedAtVal}, ${resolvedAtVal})
      RETURNING id;
    `);
    const incident = incidentRows[0];

    let currentTime = createdAt;
    let prevStatus: string | null = null;
    const actorUserId = adminUser?.id ?? reporter.id;
    for (const status of params.statuses) {
      currentTime = addMinutes(currentTime, 5);
      await prisma.incidentStatusHistory.create({
        data: {
          incidentId: incident.id,
          actorUserId,
          fromStatus: prevStatus as any,
          toStatus: status as any,
          note: 'Demo scenario status change',
          changedAt: currentTime,
        },
      });
      prevStatus = status;
    }

    await prisma.incidentAIOutput.create({
      data: {
        incidentId: incident.id,
        modelVersion: 'demo-v1',
        predictedCategory: params.category,
        severityScore: params.severityScore,
        confidence: 0.9,
        summary: 'Demo AI classification summary.',
      },
    });
  }

  private async ensureAgency(name: string, type: string) {
    const existing = await prisma.agency.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.agency.create({
      data: {
        name,
        type: type as any,
        city: 'Addis Ababa',
        description: 'Demo agency for simulation.',
        isApproved: true,
        isActive: true,
      },
    });
  }

  private async ensureDemoCitizen() {
    const existing = await prisma.user.findFirst({
      where: { email: 'demo.citizen@georise.et' },
    });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        fullName: 'Demo Citizen',
        email: 'demo.citizen@georise.et',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv', // placeholder
        role: 'CITIZEN',
        isActive: true,
      },
    });
  }
}

export const demoService = new DemoService();
