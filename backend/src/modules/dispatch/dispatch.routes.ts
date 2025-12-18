import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { assignIncident, autoAssignIncident, getRecommendations } from './dispatch.controller';

const router = Router();

// GET /api/dispatch/recommend/:incidentId
router.get(
  '/recommend/:incidentId',
  requireAuth,
  requireRole(['AGENCY_STAFF', 'ADMIN']),
  getRecommendations,
);

// POST /api/dispatch/assign
router.post('/assign', requireAuth, requireRole(['AGENCY_STAFF', 'ADMIN']), assignIncident);

// Optional: auto-assign top candidate
router.post(
  '/auto-assign/:incidentId',
  requireAuth,
  requireRole(['AGENCY_STAFF', 'ADMIN']),
  autoAssignIncident,
);

export default router;
