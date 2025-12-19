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
router.get('/me', sessionLimiter, requireAuth, me);
router.use('/', refreshRouter);

export default router;
