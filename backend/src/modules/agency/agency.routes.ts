import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getAgencies, addStaff, getStaff } from './agency.controller';

const router = Router();

// Public or Authenticated?
// Collaboration implies staff.
router.get('/', requireAuth, getAgencies);

// Agency Staff Management
router.post('/staff', requireAuth, addStaff);
router.get('/staff', requireAuth, getStaff);

export default router;
