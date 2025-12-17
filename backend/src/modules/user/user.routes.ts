import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  updateLocation,
  getNotifications,
  markRead,
  markAllRead,
  savePushSubscription,
  removePushSubscription,
} from './user.controller';

const router = Router();

router.post('/location', requireAuth, updateLocation);
router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/read-all', requireAuth, markAllRead);
router.put('/notifications/:id/read', requireAuth, markRead);
router.post('/push/subscribe', requireAuth, savePushSubscription);
router.post('/push/unsubscribe', requireAuth, removePushSubscription);

export default router;
