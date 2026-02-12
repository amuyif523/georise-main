import 'dotenv/config';
import http from 'http';
import { initSocketServer } from '../src/socket';

async function main() {
  try {
    console.log('--- Starting Decline Re-Routing Test ---');
    console.log('Original DB URL:', process.env.DATABASE_URL);
    console.log('Original REDIS URL:', process.env.REDIS_URL);

    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace('localhost', '127.0.0.1');
    }
    if (process.env.REDIS_URL) {
      process.env.REDIS_URL = process.env.REDIS_URL.replace('localhost', '127.0.0.1');
    }

    console.log('Patched DB URL:', process.env.DATABASE_URL);
    console.log('Patched REDIS URL:', process.env.REDIS_URL);

    // Dynamic import
    const { default: prisma } = await import('../src/prisma');
    const { dispatchService } = await import('../src/modules/dispatch/dispatch.service');

    // 0. Init Mock Socket Server
    const server = http.createServer();
    initSocketServer(server);

    // 1. Setup Agency & Responders
    console.log('1. Setting up Agency and Responders...');
    let agency = await prisma.agency.findFirst({ where: { name: 'ReRouting Test Agency' } });
    if (!agency) {
      agency = await prisma.agency.create({
        data: {
          name: 'ReRouting Test Agency',
          type: 'POLICE',
          city: 'Addis Ababa',
          isActive: true,
          isApproved: true,
        },
      });
    }

    // Create Responder A (The Decliner)
    const userA = await prisma.user.upsert({
      where: { email: 'responder_a@test.com' },
      update: {},
      create: {
        email: 'responder_a@test.com',
        passwordHash: 'dummy',
        fullName: 'Responder A',
        role: 'AGENCY_STAFF',
        phone: '+251999999988',
      },
    });

    // Fix: Use findFirst instead of upsert for non-unique userId
    let responderA = await prisma.responder.findFirst({ where: { userId: userA.id } });
    if (responderA) {
      responderA = await prisma.responder.update({
        where: { id: responderA.id },
        data: { status: 'AVAILABLE', latitude: 9.0, longitude: 38.7, agencyId: agency.id },
      });
    } else {
      responderA = await prisma.responder.create({
        data: {
          name: 'Responder A',
          type: 'POLICE',
          agencyId: agency.id,
          userId: userA.id,
          status: 'AVAILABLE',
          latitude: 9.0,
          longitude: 38.7,
        },
      });
    }

    // Create Responder B (The Backup) - slightly further away but available
    const userB = await prisma.user.upsert({
      where: { email: 'responder_b@test.com' },
      update: {},
      create: {
        email: 'responder_b@test.com',
        passwordHash: 'dummy',
        fullName: 'Responder B',
        role: 'AGENCY_STAFF',
        phone: '+251999999977',
      },
    });

    // Fix: Use findFirst instead of upsert for non-unique userId
    let responderB = await prisma.responder.findFirst({ where: { userId: userB.id } });
    if (responderB) {
      responderB = await prisma.responder.update({
        where: { id: responderB.id },
        data: { status: 'AVAILABLE', latitude: 9.01, longitude: 38.71, agencyId: agency.id },
      });
    } else {
      responderB = await prisma.responder.create({
        data: {
          name: 'Responder B',
          type: 'POLICE',
          agencyId: agency.id,
          userId: userB.id,
          status: 'AVAILABLE',
          latitude: 9.01,
          longitude: 38.71,
        },
      });
    }

    // 2. Create Incident (Critical for Auto-Pilot)
    console.log('2. Creating Critical Incident...');
    const incident = await prisma.incident.create({
      data: {
        title: 'ReRouting Test Incident',
        description: 'Testing decline logic',
        latitude: 9.0,
        longitude: 38.7,
        status: 'RECEIVED',
        severityScore: 5, // Critical for auto-pilot
        category: 'Crime',
        reportedAt: new Date(),
      },
    });

    // 3. Assign to Responder A
    console.log('3. Assigning to Responder A...');
    await dispatchService.assignIncident(incident.id, agency.id, responderA.id, userA.id);

    // 4. Responder A Declines
    console.log('4. Responder A Declines...');
    await dispatchService.declineAssignment(incident.id, responderA.id, 'Too busy', userA.id);

    // 5. Verify Results
    console.log('5. Verifying Results...');

    // Check Incident
    const updatedIncident = await prisma.incident.findUnique({ where: { id: incident.id } });

    // A should be in declined list
    const declinedIds = (updatedIncident as any)?.declinedResponderIds || [];
    if (declinedIds.includes(responderA.id)) {
      console.log('   SUCCESS: Responder A is in declinedResponderIds.');
    } else {
      console.error('   FAILURE: Responder A NOT in declinedResponderIds:', declinedIds);
    }

    // Check Auto-Assignment
    // Since auto-assignment is triggered in background (awaited in my code though),
    // checks if Responder B got it.
    if (updatedIncident?.assignedResponderId === responderB.id) {
      console.log('   SUCCESS: Incident auto-assigned to Responder B.');
      console.log('   Auto-Pilot worked correctly through exclusion filter.');
    } else {
      console.log(
        `   INFO: Incident assigned to: ${updatedIncident?.assignedResponderId} (Expected ${responderB.id})`,
      );

      // If not assigned, maybe auto-pilot failed conditions (distance, score)?
      // Let's manually check re-recommendation
      const recs = await dispatchService.recommendForIncident(incident.id);
      const top = recs[0];
      console.log('   Top Recommendation now:', { unitId: top.unitId, score: top.totalScore });

      if (top.unitId === responderB.id) {
        console.log('   SUCCESS: Responder B is top recommendation.');
      } else {
        console.error('   FAILURE: Responder B is NOT top recommendation.');
      }

      // Check if A is in recs
      const aInRecs = recs.find((r) => r.unitId === responderA.id);
      if (!aInRecs) {
        console.log('   SUCCESS: Responder A excluded from recommendations.');
      } else {
        console.error('   FAILURE: Responder A STILL in recommendations.');
      }
    }
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
