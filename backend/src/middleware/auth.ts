import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authService } from '../modules/auth/auth.service';
import logger from '../logger';

import redis from '../redis';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);

    // Sprint 6: Session Revocation Check
    const isRevoked = await redis.get(`revoked:user:${payload.userId}`);
    if (isRevoked) {
      return res.status(401).json({ message: 'Session revoked. Please contact administration.' });
    }

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

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);

    const isRevoked = await redis.get(`revoked:user:${payload.userId}`);
    if (isRevoked) {
      return res.status(401).json({ message: 'Session revoked. Please contact administration.' });
    }

    req.user = {
      id: payload.userId,
      role: payload.role,
      agencyId: payload.agencyId,
    };

    return next();
  } catch (err) {
    logger.error({ err }, 'Optional Auth error');
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
