import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authService } from '../modules/auth/auth.service';
import logger from '../logger';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);

    req.user = {
      id: payload.userId,
      role: payload.role,
      agencyId: payload.agencyId,
    };

    return next();
  } catch (err) {
    logger.error({ err }, 'Auth error');
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
};
