
import { Request, Response } from 'express';
import { agencyService } from './agency.service'; // Ensure correct import path?

export const getAgencies = async (req: Request, res: Response) => {
    try {
        const agencies = await agencyService.getAgencies();
        return res.json({ agencies });
    } catch (error) {
        console.error('Get agencies error', error);
        return res.status(500).json({ message: 'Failed to fetch agencies' });
    }
};
