
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getAgencies } from './agency.controller';

const router = Router();

// Public or Authenticated?
// Collaboration implies staff.
router.get('/', requireAuth, getAgencies);

export default router;
