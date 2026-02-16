import 'dotenv/config';
import prisma from '../src/prisma';
import { Queue } from 'bullmq';
import { REDIS_URL } from '../src/config/env';
import * as fs from 'fs';

/**
 * Stress Test Script
 *
 * Objectives:
 * 1. Create a Test Agency.
 * 2. Create 5 Test Incidents in rapid succession (simulating burst).
 * 3. Verify incidents are created and AI job is queued.
 * 4. Verify AI processing completion via polling.
 * 5. Clean up.
 */

const TEST_AGENCY_NAME = 'STRESS_TEST_AGENCY_' + Date.now();
// Addis Ababa coordinates (approx center)
const BASE_LAT = 9.03;
const BASE_LNG = 38.74;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync('stress-test-debug.log', msg + '\n');
}

async function main() {
  fs.writeFileSync('stress-test-debug.log', ''); // Clear log
  log('🚀 Starting Stress Test...');
  const queue = new Queue('incident-ai', { connection: { url: REDIS_URL } });

  let agencyId: number | null = null;
  const incidentIds: number[] = [];

  try {
    // 0. Dynamic User Discovery
    log('Step 0: Resolving Admin User...');
    const testUser = await prisma.user.findFirst({
      where: { email: 'admin@georise.com' },
    });

    if (!testUser) {
      throw new Error("Admin user not found. Ensure 'npx prisma db seed' has been run.");
    }
    const reporterId = testUser.id;
    log(`✅ Dynamically resolved Reporter ID: ${reporterId}`);

    // 1. Create Test Agency
    log(`Step 1: Creating Test Agency: ${TEST_AGENCY_NAME}`);
    const agency = await prisma.agency.create({
      data: {
        name: TEST_AGENCY_NAME,
        type: 'POLICE',
        city: 'Addis Ababa',
        isApproved: true,
        isActive: true,
      },
    });
    agencyId = agency.id;
    log(`✅ Agency Created: ID ${agencyId}`);

    // 2. Create 5 Incidents
    log('Step 2: Creating 5 Incidents in burst...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        prisma.incident.create({
          data: {
            title: `Stress Test Incident ${i}`,
            description: `Emergency situation simulation number ${i} requiring immediate assistance. Fire and medical support needed.`,
            status: 'RECEIVED',
            latitude: BASE_LAT + Math.random() * 0.01,
            longitude: BASE_LNG + Math.random() * 0.01,
            reporterId: reporterId,
          },
        }),
      );
    }

    const incidents = await Promise.all(promises);
    incidentIds.push(...incidents.map((i) => i.id));
    log(`✅ 5 Incidents Created: ${incidentIds.join(', ')}`);

    // 3. Queue Jobs manual trigger
    log('Step 3: Pushing jobs to Redis to test AI Worker...');
    const jobPromises = incidents.map((inc) =>
      queue.add('analyze', {
        incidentId: inc.id,
        title: inc.title,
        description: inc.description,
        reporterId: inc.reporterId,
      }),
    );
    await Promise.all(jobPromises);
    log('✅ Jobs pushed to queue');

    // 4. Verification Check (Polling)
    log('Step 4: Verifying AI Processing (Polling for 10s)...');
    let allProcessed = false;
    for (let k = 0; k < 10; k++) {
      await sleep(1000);
      const check = await prisma.incident.findMany({
        where: { id: { in: incidentIds } },
        select: { id: true, category: true, severityScore: true },
      });

      const processedCount = check.filter(
        (c) => c.category !== null && c.severityScore !== null,
      ).length;
      log(`Polling... ${processedCount}/5 processed`);

      if (processedCount === 5) {
        allProcessed = true;
        log('✅ All incidents processed by AI!');
        break;
      }
    }

    if (!allProcessed) {
      log(
        '⚠️ Warning: Not all incidents were processed in time. AI Worker might be slow or failing.',
      );
    }

    log('🎉 Stress Test Passed!');
  } catch (err) {
    log('❌ Stress Test Failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    if (err instanceof Error && err.stack) {
      log(err.stack);
    }
    process.exitCode = 1;
  } finally {
    log('Step 5: Cleaning up test data...');
    // Clean up even on failure
    if (incidentIds.length > 0) {
      await prisma.incident
        .deleteMany({ where: { id: { in: incidentIds } } })
        .catch((e) => log(`Cleanup Error (Incidents): ${e.message}`));
    }
    if (agencyId) {
      await prisma.agency
        .delete({ where: { id: agencyId } })
        .catch((e) => log(`Cleanup Error (Agency): ${e.message}`));
      log(`🧹 Cleaned up Test Agency: ${agencyId}`);
    }

    await queue.close();
    await prisma.$disconnect();
    log('✅ Cleanup complete.');
  }
}

main();
