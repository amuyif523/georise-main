import prisma from '../prisma';

export const ensureTestAgency = async () => {
  try {
    const agency = await prisma.agency.findFirst({ where: { id: 1 } });
    if (!agency) {
      console.log('Seeding Test Agency (ID 1)...');
      await prisma.agency.create({
        data: {
          id: 1, // Force ID 1 if possible, or just create
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
  } catch (err) {
    console.error('Failed to seed agency:', err);
  }
};
