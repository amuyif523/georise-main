import { Role, StaffRole, AgencyType } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import prisma from '../src/prisma';

const SEED_PASSWORD = 'password123';

async function clearDatabase() {
  console.log('--- CLEARING DATABASE ---');
  // Delete many in correct order to respect foreign keys
  await prisma.activityLog.deleteMany({});
  await prisma.classificationAudit.deleteMany({});
  await prisma.incidentAIOutput.deleteMany({});
  await prisma.incidentPhoto.deleteMany({});
  await prisma.incidentStatusHistory.deleteMany({});
  await prisma.sharedIncident.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.responder.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.incidentChat.deleteMany({});
  await prisma.pushSubscription.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.citizenVerification.deleteMany({});
  await prisma.agencyStaff.deleteMany({});
  await prisma.agencyJurisdiction.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.dispatchRule.deleteMany({});
  await prisma.woreda.deleteMany({});
  await prisma.subCity.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Database cleared natively via deleteMany.');
}

async function main() {
  await clearDatabase();
  console.log('--- SEEDING NEW ENVIRONMENT ---');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // 1. Super Admin as SUPERVISOR
  const sysAdmin = await prisma.user.create({
    data: {
      email: 'admin@georise.com',
      fullName: 'GeoRise Systems Administrator',
      phone: '+251911000000',
      passwordHash: passwordHash,
      role: Role.ADMIN, // Base user role must be ADMIN or AGENCY_STAFF
      isActive: true,
      deletedAt: null,
    },
  });
  console.log(`- Created Base User for Admin: ${sysAdmin.email}`);

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

  // Assign Admin as a SUPERVISOR for Bole Agency
  await prisma.agencyStaff.create({
    data: {
      userId: sysAdmin.id,
      agencyId: boleAgency.id,
      staffRole: StaffRole.SUPERVISOR,
      isActive: true,
      deactivatedAt: null,
    },
  });
  console.log(`- Assigned admin@georise.com as SUPERVISOR to Bole Agency`);

  // 3. Responders
  const responderNames = ['Bole-Alpha', 'Bole-Bravo', 'Bole-Charlie'];
  for (const rName of responderNames) {
    const userHash = await bcrypt.hash(`${rName.toLowerCase()}123`, 10);
    const user = await prisma.user.create({
      data: {
        email: `${rName.toLowerCase()}@georise.com`,
        fullName: `Officer ${rName}`,
        passwordHash: userHash,
        role: Role.AGENCY_STAFF,
        isActive: true,
        deletedAt: null,
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
        latitude: boleAgency.centerLatitude,
        longitude: boleAgency.centerLongitude,
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
