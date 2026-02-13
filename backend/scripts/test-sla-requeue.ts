import 'dotenv/config';
import http from 'http';
import { initSocketServer } from '../src/socket';

async function main() {
  try {
    console.log('--- Starting SLA Requeue Test ---');

    // Fix localhost ipv6 issue if any
    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace('localhost', '127.0.0.1');
    }
    console.log('DB URL Loaded:', !!process.env.DATABASE_URL);

    // Dynamic import to ensure env is loaded first
    const { default: prisma } = await import('../src/prisma');
    const { runSLAChecks } = await import('../src/jobs/sla.job');

    // 0. Init Mock Socket Server for getIO()
    const server = http.createServer();
    initSocketServer(server);
    console.log('0. Mock Socket Server initialized.');

    // 1. Setup Incident and Responder
    console.log('1. Setting up Incident and Responder...');

    // Create or find a test user for responder
    let user = await prisma.user.findFirst({ where: { email: 'sla_test_responder@test.com' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'sla_test_responder@test.com',
          passwordHash: 'dummy',
          fullName: 'SLA Test Responder',
          role: 'AGENCY_STAFF',
          phone: '+251999999999',
        },
      });
    }

    // Ensure Agency exists
    let agency = await prisma.agency.findFirst();
    if (!agency) {
      agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          type: 'POLICE',
          city: 'Addis Ababa',
          isActive: true,
          isApproved: true,
        },
      });
    }

    // Ensure Responder Profile
    let responder = await prisma.responder.findFirst({ where: { userId: user.id } });
    if (!responder) {
      responder = await prisma.responder.create({
        data: {
          name: user.fullName,
          type: 'POLICE',
          agencyId: agency.id,
          userId: user.id,
          status: 'AVAILABLE',
        },
      });
    } else {
      await prisma.responder.update({
        where: { id: responder.id },
        data: { status: 'AVAILABLE' },
      });
    }

    // Create Incident
    const incident = await prisma.incident.create({
      data: {
        title: 'SLA Timeout Test',
        description: 'Testing auto-requeue logic',
        latitude: 9.0,
        longitude: 38.7,
        status: 'RECEIVED',
        reportedAt: new Date(),
      },
    });
    console.log(`   Incident created: ID ${incident.id}`);

    // 2. Assign Incident
    console.log(`2. Assigning Incident...`);
    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: 'ASSIGNED',
        assignedResponderId: responder.id,
        assignedAgencyId: agency.id,
        dispatchedAt: new Date(), // Now
        acknowledgedAt: null,
      },
    });
    await prisma.responder.update({
      where: { id: responder.id },
      data: { status: 'ASSIGNED' },
    });
    console.log('   Assigned.');

    // 3. Simulate Time Travel
    console.log('3. Simulating Time Travel (2 mins ago)...');
    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        dispatchedAt: new Date(Date.now() - 120 * 1000), // 2 mins ago
      },
    });

    // 4. Run SLA Checks
    console.log('4. Running SLA Checks...');
    await runSLAChecks();

    // 5. Verify
    console.log('5. Verifying Result...');
    const updatedIncident = await prisma.incident.findUnique({ where: { id: incident.id } });
    const updatedResponder = await prisma.responder.findUnique({ where: { id: responder.id } });

    let success = true;

    if (updatedIncident?.status === 'RECEIVED' && updatedIncident?.assignedResponderId === null) {
      console.log('   SUCCESS: Incident re-queued (Status: RECEIVED).');
    } else {
      console.error(
        `   FAILURE: Incident status is ${updatedIncident?.status}, RespID: ${updatedIncident?.assignedResponderId}`,
      );
      success = false;
    }

    if (updatedResponder?.status === 'AVAILABLE') {
      console.log('   SUCCESS: Responder released (Status: AVAILABLE).');
    } else {
      console.error(`   FAILURE: Responder status is ${updatedResponder?.status}`);
      success = false;
    }

    const logs = await prisma.activityLog.findMany({
      where: { incidentId: incident.id, type: 'SYSTEM' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    if (logs.length > 0 && logs[0].message.includes('Assignment Timeout')) {
      console.log('   SUCCESS: Activity Log found.');
    } else {
      console.error('   FAILURE: No Activity Log found.');
      success = false;
    }

    if (!success) process.exit(1);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    //
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
