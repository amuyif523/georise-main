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

export const addStaff = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, staffRole } = req.body;
    const agencyId = req.user?.agencyId;

    if (!agencyId) {
      return res.status(403).json({ message: 'Only agency staff can add members' });
    }

    // Basic validation
    if (!fullName || !email || !phone || !staffRole) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await agencyService.addStaff(agencyId, { fullName, email, phone, staffRole });
    return res.status(201).json({ message: 'Staff added successfully' });
  } catch (error: any) {
    console.error('Add staff error', error);
    return res.status(400).json({ message: error.message || 'Failed to add staff' });
  }
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) return res.status(403).json({ message: 'Unauthorized' });

    const staff = await agencyService.getStaff(agencyId);
    return res.json({ staff });
  } catch (error) {
    console.error('Get staff error', error);
    return res.status(500).json({ message: 'Failed to fetch staff' });
  }
};
