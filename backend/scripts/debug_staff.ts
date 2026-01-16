import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.user.findUnique({
        where: { email: 'staff1@example.com' },
        include: {
            agencyStaff: {
                include: {
                    agency: {
                        include: {
                            jurisdictions: {
                                include: {
                                    subCity: true,
                                    woreda: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!staff || !staff.agencyStaff) {
        console.log('Staff1 not found or not linked to agency');
        return;
    }

    const agency = staff.agencyStaff.agency;
    console.log('Staff1 Agency:', {
        name: agency.name,
        type: agency.type,
        city: agency.city,
        jurisdictions: agency.jurisdictions.map(j => j.subCity?.name || j.woreda?.name + ' (Woreda)')
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
