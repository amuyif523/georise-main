import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
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
import { authLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/otp/request', authLimiter, requestOtp);
router.post('/otp/verify', authLimiter, verifyOtp);
router.post(
  '/password-reset/request',
  authLimiter,
  validateBody(passwordResetRequestSchema),
  requestPasswordReset,
);
router.post(
  '/password-reset/confirm',
  validateBody(passwordResetConfirmSchema),
  confirmPasswordReset,
);
router.get('/me', requireAuth, me);
router.use('/', refreshRouter);

export default router;
