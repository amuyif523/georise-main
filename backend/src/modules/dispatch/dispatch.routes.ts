import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  assignIncident,
  autoAssignIncident,
  getRecommendations,
  acknowledgeIncident,
  declineIncident,
} from './dispatch.controller';
import { Role } from '@prisma/client';

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

// Responder Actions
router.post(
  '/acknowledge',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  acknowledgeIncident,
); // Ideally Responder role is used if separated, but currently mapped to AGENCY_STAFF logic often.
// Wait, Responders might have CITIZEN role or AGENCY_STAFF role?
// Schema says `Role { AGENCY_STAFF }`. `AgencyStaff` has `staffRole: RESPONDER`.
// But user table has `role: Role`.
// A responder user should have `role: AGENCY_STAFF`.
// So `requireRole(['AGENCY_STAFF'])` covers responders.

router.post('/decline', requireAuth, requireRole([Role.AGENCY_STAFF, Role.ADMIN]), declineIncident);

// Optional: auto-assign top candidate
router.post(
  '/auto-assign/:incidentId',
  requireAuth,
  requireRole(['AGENCY_STAFF', 'ADMIN']),
  autoAssignIncident,
);

export default router;
