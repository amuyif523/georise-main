import { Request, Response } from 'express';
import { agencyService } from './agency.service'; // Ensure correct import path?
import prisma from '../../prisma';

export const getAgencies = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await agencyService.getAgencies({
      page,
      limit,
      search: req.query.search as string,
      status: req.query.status as any,
      type: req.query.type as any,
    });
    return res.json({ ...result, page, limit });
  } catch (error) {
    console.error('Get agencies error', error);
    return res.status(500).json({ message: 'Failed to fetch agencies' });
  }
};

export const createAgency = async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      city,
      description,
      isApproved,
      isActive,
      centerLatitude,
      centerLongitude,
      admin,
    } = req.body;

    if (!admin || !admin.email || !admin.fullName) {
      return res.status(400).json({ message: 'Admin details (email, fullName) are required' });
    }

    if (centerLatitude === undefined || centerLongitude === undefined) {
      return res
        .status(400)
        .json({
          message:
            'Operational Requirement: Every agency must have a physical headquarters defined for dispatch logistics.',
        });
    }

    const result = await agencyService.createAgencyWithAdmin(
      { name, type, city, description, isApproved, isActive, centerLatitude, centerLongitude },
      admin,
    );

    // Audit is handled in route or here?
    // Route in admin.routes used to handle it.
    // Ideally service doesn't depend on req.user for audit, keeping it pure.
    // Controller can handle audit or route.
    // For now, return result.

    return res.status(201).json({
      agency: result.agency,
      admin: { ...result.user, tempPassword: result.tempPassword },
    });
  } catch (error: any) {
    console.error('Create agency error', error);
    return res.status(400).json({ message: error.message || 'Failed to create agency' });
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
    return res.json({ staff: staff || [] });
  } catch (error) {
    console.error('Get staff error', error);
    return res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

export const toggleStaffStatus = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const { isActive } = req.body;
    const requesterAgencyId = req.user?.agencyId;

    if (!requesterAgencyId) return res.status(403).json({ message: 'Unauthorized' });

    // The "No-Suicide" Rule
    if (!isActive && userId === req.user?.id) {
      return res
        .status(403)
        .json({ message: 'Action Denied: You cannot deactivate your own administrative account' });
    }

    // Verify target user belongs to requester's agency
    const targetStaff = await prisma.agencyStaff.findUnique({
      where: { userId },
    });

    if (!targetStaff || targetStaff.agencyId !== requesterAgencyId) {
      return res.status(404).json({ message: 'Staff member not found in your agency' });
    }

    const updatedUser = await agencyService.setStaffStatus(userId, isActive);
    return res.json({ message: 'Status updated', user: updatedUser });
  } catch (error: any) {
    console.error('Toggle staff status error', error);
    return res.status(400).json({ message: error.message || 'Failed to update status' });
  }
};
export const getProfile = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      console.warn('GetProfile: No agencyId in user token', req.user);
      return res.status(401).json({ message: 'Unauthorized: No agency context' });
    }

    const agency = await agencyService.getProfile(agencyId);
    if (!agency) {
      return res.status(404).json({ message: 'Agency not found' });
    }

    return res.json(agency);
  } catch (error: any) {
    console.error('Get agency profile error:', error);
    // Return a generic error to client but log full details
    return res.status(500).json({ message: 'Internal Server Error fetching profile' });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const requesterAgencyId = req.user?.agencyId;
    const requesterId = req.user?.id;

    if (!requesterAgencyId || !requesterId)
      return res.status(403).json({ message: 'Unauthorized' });

    // Verify target user belongs to requester's agency
    const targetStaff = await prisma.agencyStaff.findUnique({
      where: { userId },
    });

    if (!targetStaff || targetStaff.agencyId !== requesterAgencyId) {
      return res.status(404).json({ message: 'Staff member not found in your agency' });
    }

    await agencyService.deleteStaff(userId, requesterId);
    return res.json({ message: 'Staff member successfully deleted' });
  } catch (error: any) {
    console.error('Delete staff error', error);
    // Map service layer errors to appropriate HTTP status codes
    if (error.message.includes('Action Denied')) {
      return res.status(403).json({ message: error.message });
    }
    if (error.message.includes('Staff must be deactivated')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message || 'Failed to delete staff' });
  }
};
