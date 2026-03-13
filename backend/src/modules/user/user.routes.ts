import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { idUpload } from '../../middleware/upload';
import {
  updateLocation,
  getNotifications,
  markRead,
  markAllRead,
  savePushSubscription,
  removePushSubscription,
} from './user.controller';
import { submitVerificationRequest, getVerificationStatus } from './verification.controller';

const router = Router();

router.post('/location', requireAuth, updateLocation);
router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/read-all', requireAuth, markAllRead);
router.put('/notifications/:id/read', requireAuth, markRead);
router.post('/push/subscribe', requireAuth, savePushSubscription);
router.post('/push/unsubscribe', requireAuth, removePushSubscription);

// Identity Verification
router.post('/verify', requireAuth, idUpload.single('idPhoto'), submitVerificationRequest);
router.get('/verify/status', requireAuth, getVerificationStatus);

export default router;
