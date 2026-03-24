import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      role: Role;
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
