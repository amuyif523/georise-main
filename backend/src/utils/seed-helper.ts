import prisma from '../prisma';

export const ensureTestAgency = async () => {
  if (process.env.DB_READ_ONLY === 'true') {
    console.log('Skipping seed (Read-Only Mode)');
    return;
  }
  try {
    // Check if ID 1 exists safely
    const agency = await prisma.agency.findUnique({ where: { id: 1 } });

    if (!agency) {
      console.log('Seeding Test Agency (ID 1)...');
      // Use upsert to be extra safe against race conditions
      await prisma.agency.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          name: 'Test Agency',
          type: 'POLICE',
          city: 'Addis Ababa',
          isApproved: true,
          isActive: true,
        },
      });
      console.log('Test Agency Seeded.');
    } else {
      console.log('Test Agency (ID 1) exists.');
    }
  } catch (err: any) {
    console.error('Failed to seed agency (non-fatal):', err.message);
  }
};
