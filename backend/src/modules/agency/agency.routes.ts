import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getAgencies, addStaff, getStaff } from './agency.controller';

import prisma from '../../prisma';

const router = Router();

// Temporary route for testing
router.get('/test-activate', async (req, res) => {
  try {
    await prisma.agency.update({
      where: { id: 1 },
      data: { isActive: true, isApproved: true },
    });
    res.json({ message: 'Agency 1 activated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public or Authenticated?
// Collaboration implies staff.
router.get('/', requireAuth, getAgencies);

// Agency Staff Management
router.post('/staff', requireAuth, addStaff);
router.get('/staff', requireAuth, getStaff);

export default router;
