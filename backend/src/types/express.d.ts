import type { Role } from '@prisma/client';

type EffectiveRole = Role | 'RESPONDER';

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      role: EffectiveRole;
      isVerified: boolean;
      mustChangePassword?: boolean;
      agencyId?: number | null;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
