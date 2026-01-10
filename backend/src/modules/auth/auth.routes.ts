import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { Role } from '@prisma/client';
import { authService } from './auth.service';
import {
  login,
  me,
  register,
  requestOtp,
  verifyOtp,
  requestPasswordReset,
  confirmPasswordReset,
} from './auth.controller';
import { validateBody } from '../../middleware/validate';
import {
  loginSchema,
  registerSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from './auth.validation';
import refreshRouter from './refresh.routes';
import { loginLimiter, sessionLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/otp/request', loginLimiter, requestOtp);
router.post('/otp/verify', loginLimiter, verifyOtp);
router.post(
  '/password-reset/request',
  loginLimiter,
  validateBody(passwordResetRequestSchema),
  requestPasswordReset,
);
router.post(
  '/password-reset/confirm',
  validateBody(passwordResetConfirmSchema),
  confirmPasswordReset,
);
router.get('/me', requireAuth, sessionLimiter, me);

router.post(
  '/revoke/:userId',
  requireAuth,
  requireRole([Role.ADMIN]),
  async (req: any, res: any) => {
    try {
      const userId = Number(req.params.userId);
      await authService.revokeSession(userId);
      res.json({ success: true, message: `User ${userId} revoked.` });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.use('/', refreshRouter);

export default router;
