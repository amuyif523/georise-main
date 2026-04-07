import { Role, StaffRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../src/prisma';

async function run() {
  console.log('--- GEORISE OPERATIONAL RESEED ---');

  // STEP 1: THE WIPE (Cascading Deletions)
  console.log('1. Truncating volatile operational logic [Incident, ActivityLog, Responder]...');
  await prisma.activityLog.deleteMany({});
  await prisma.classificationAudit.deleteMany({});
  await prisma.incidentPhoto.deleteMany({});
  await prisma.incidentStatusHistory.deleteMany({});
  await prisma.sharedIncident.deleteMany({});
  await prisma.incidentChat.deleteMany({});
  await prisma.incidentAIOutput.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.responder.deleteMany({});

  console.log('2. Truncating core organizational data [AgencyStaff, Agency, User]...');
  await prisma.auditLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.pushSubscription.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.citizenVerification.deleteMany({});
  await prisma.agencyStaff.deleteMany({});
  await prisma.agencyJurisdiction.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database successfully wiped.');

  // STEP 2: THE SEED
  console.log('\n--- SEEDING NEW ENVIRONMENT ---');

  // 1. Super Admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const sysAdmin = await prisma.user.create({
    data: {
      email: 'admin@georise.com',
      fullName: 'GeoRise Systems Administrator',
      phone: '+251911000000',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`- Created Super Admin: ${sysAdmin.email}`);

  // 2. Bole Agency
  const boleAgency = await prisma.agency.create({
    data: {
      name: 'Bole District Command Center',
      type: 'POLICE',
      city: 'Addis Ababa',
      description: 'Primary rapid response node for Bole sub-city.',
      isApproved: true,
      isActive: true,
      centerLatitude: 9.0,
      centerLongitude: 38.785,
      // Default empty Polygon required by front-end profile map if we don't have real ST_GeomFromGeoJSON
    },
  });
  console.log(`- Created Agency: ${boleAgency.name}`);

  // 3. Responders
  const responderNames = ['Bole-Alpha', 'Bole-Bravo', 'Bole-Charlie'];
  const createdResponders = [];
  for (const rName of responderNames) {
    const userHash = await bcrypt.hash(`${rName.toLowerCase()}123`, 10);
    const user = await prisma.user.create({
      data: {
        email: `${rName.toLowerCase()}@georise.com`,
        fullName: `Officer ${rName}`,
        passwordHash: userHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
      },
    });

    await prisma.agencyStaff.create({
      data: {
        userId: user.id,
        agencyId: boleAgency.id,
        staffRole: StaffRole.RESPONDER,
        isActive: true,
      },
    });

    const res = await prisma.responder.create({
      data: {
        name: user.fullName,
        type: 'Patrol Vehicle',
        agencyId: boleAgency.id,
        userId: user.id,
        status: 'AVAILABLE',
        latitude: boleAgency.centerLatitude,
        longitude: boleAgency.centerLongitude,
      },
    });
    createdResponders.push(res);
    console.log(`- Created Responder Unit: ${rName}`);
  }

  // 4. Sample Incidents
  const insideIncident = await prisma.incident.create({
    data: {
      title: 'Traffic Collision on Bole Road',
      description: 'Multiple vehicles involved near Friendship Square. Potential minor injuries.',
      latitude: 8.995,
      longitude: 38.789,
      severityScore: 7, // High priority
      status: 'RECEIVED',
      assignedAgencyId: boleAgency.id,
    },
  });
  console.log(`- Created Incident INSIDE Jurisdiction: ${insideIncident.title}`);

  const outsideIncident = await prisma.incident.create({
    data: {
      title: 'Disturbance in Piazza',
      description: 'Noise complaint and loitering in Arada district.',
      latitude: 9.03,
      longitude: 38.75,
      severityScore: 3, // Low priority
      status: 'RECEIVED',
      // No assignedAgencyId because it's not near Bole
    },
  });
  console.log(`- Created Incident OUTSIDE Jurisdiction: ${outsideIncident.title}`);

  console.log('\n--- SEED COMPLETE ---');
  console.log('Use admin@georise.com // admin123 to log in.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
