import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying Seed Data...');

    const users = await prisma.user.findMany({
        where: {
            email: {
                in: ['admin@example.com', 'citizen@georise.com', 'police@georise.com', 'fire@georise.com']
            }
        },
        select: { email: true, role: true }
    });

    const agencies = await prisma.agency.findMany({
        select: { name: true, type: true }
    });

    const incidents = await prisma.incident.findMany({
        select: { title: true, category: true }
    });

    console.log('Users Found:', users);
    console.log('Agencies Found:', agencies);
    console.log('Incidents count:', incidents.length);

    if (users.length >= 4 && agencies.length >= 4) {
        console.log('VERIFICATION SUCCESS: New seed data is present.');
    } else {
        console.log('VERIFICATION FAILED: Data seems missing or incorrect.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
