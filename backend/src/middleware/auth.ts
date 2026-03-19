import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authService } from '../modules/auth/auth.service';
import logger from '../logger';
import prisma from '../prisma';

import redis from '../redis';

const getAuthenticatedUser = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isVerified: true,
      isActive: true,
      deactivatedAt: true,
      agencyStaff: {
        select: {
          agencyId: true,
        },
      },
    },
  });

  if (!user || user.isActive === false || user.deactivatedAt) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    isVerified: user.isVerified,
    agencyId: user.agencyStaff?.agencyId ?? null,
  };
};

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

    const authenticatedUser = await getAuthenticatedUser(payload.userId);
    if (!authenticatedUser) {
      return res.status(401).json({ message: 'User not active' });
    }

    req.user = authenticatedUser;

    // Sprint 6: Scope Hardening
    // If request contains agencyId param/body, ensure it matches user's agency
    // (Ignoring strictly purely 'get' queries for now if they don't imply 'action', but logically strict read is good too)
    // Actually, params usually implies "acting ON this agency" or "fetching FOR this agency".
    // For agency_staff, they shouldn't use a route with :agencyId that isn't theirs.
    if (req.params.agencyId && req.user.role === 'AGENCY_STAFF') {
      const requestedId = parseInt(req.params.agencyId);
      if (!isNaN(requestedId) && requestedId !== req.user.agencyId) {
        return res.status(403).json({ message: 'Forbidden: You can only access your own agency' });
      }
    }

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

    const authenticatedUser = await getAuthenticatedUser(payload.userId);
    if (!authenticatedUser) {
      return next();
    }

    req.user = authenticatedUser;

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
