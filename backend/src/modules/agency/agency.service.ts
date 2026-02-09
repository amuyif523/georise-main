
import prisma from '../../prisma';

export class AgencyService {
    async getAgencies() {
        return prisma.agency.findMany({
            where: {
                isActive: true,
                isApproved: true,
            },
            select: {
                id: true,
                name: true,
                type: true,
                city: true,
            },
            orderBy: { name: 'asc' },
        });
    }
}

export const agencyService = new AgencyService();
