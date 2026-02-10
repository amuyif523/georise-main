import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { subscribe } from './push.controller';

const router = Router();

router.post('/subscribe', requireAuth, subscribe);

export default router;
