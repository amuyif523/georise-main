import prisma from '../src/prisma';

const ADDIS_CENTER_LAT = 9.0192;
const ADDIS_CENTER_LNG = 38.7525;

async function run() {
  console.log('Running Responder Coordinate Repair Script...');

  // Phase 1: Identify broken records
  const brokenResponders = await prisma.responder.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    include: {
      agency: {
        select: { centerLatitude: true, centerLongitude: true },
      },
    },
  });

  if (brokenResponders.length === 0) {
    console.log('No broken responders found. All units have coordinates.');
    await prisma.$disconnect();
    return;
  }

  console.log(
    `Found ${brokenResponders.length} responder(s) missing GPS coordinates. Repairing...`,
  );

  // Phase 2: Mend each record
  for (const responder of brokenResponders) {
    const lat = responder.agency?.centerLatitude ?? ADDIS_CENTER_LAT;
    const lng = responder.agency?.centerLongitude ?? ADDIS_CENTER_LNG;

    await prisma.responder.update({
      where: { id: responder.id },
      data: {
        latitude: lat,
        longitude: lng,
      },
    });

    console.log(`- Patched [${responder.name}] to position: [${lat}, ${lng}]`);
  }

  console.log('Cleanup complete!');
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
