import { Router } from 'express';
import { authService } from './auth.service';
import { validateBody } from '../../middleware/validate';
import { refreshSchema } from './auth.validation';
import logger from '../../logger';

const router = Router();

router.post('/refresh', validateBody(refreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.rotateRefresh(refreshToken);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, 'Refresh token error');
    return res.status(401).json({ message: err?.message || 'Invalid refresh token' });
  }
});

export default router;
