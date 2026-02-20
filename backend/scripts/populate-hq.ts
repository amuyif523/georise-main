import prisma from '../src/prisma';

async function main() {
  console.log('Starting HQ backfill script...');

  // Find all agencies where centerLat or centerLng is null
  const agencies = await prisma.$queryRaw<any[]>`
    SELECT id, name, jurisdiction IS NOT NULL as has_jurisdiction 
    FROM "Agency" 
    WHERE "centerLatitude" IS NULL OR "centerLongitude" IS NULL;
  `;

  console.log(`Found ${agencies.length} agencies needing HQ coordinates.`);

  let updatedCount = 0;
  for (const agency of agencies) {
    if (agency.has_jurisdiction) {
      console.log(`Calculating ST_Centroid for Agency ${agency.id} (${agency.name})...`);
      // Update the agency with the centroid of its jurisdiction
      await prisma.$executeRaw`
        UPDATE "Agency"
        SET 
          "centerLongitude" = ST_X(ST_Centroid(jurisdiction::geometry)),
          "centerLatitude" = ST_Y(ST_Centroid(jurisdiction::geometry))
        WHERE id = ${agency.id};
      `;
      updatedCount++;
    } else {
      console.log(`Agency ${agency.id} (${agency.name}) has no jurisdiction polygon. Falling back to Addis Ababa center.`);
      // Fallback to general center of Addis Ababa if no polygon exists
      await prisma.$executeRaw`
        UPDATE "Agency"
        SET 
          "centerLongitude" = 38.74,
          "centerLatitude" = 9.03
        WHERE id = ${agency.id};
      `;
      updatedCount++;
    }
  }

  console.log(`Script finished. Updated ${updatedCount} agencies.`);
}

main()
  .catch((e) => {
    console.error('Migration script failed:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
