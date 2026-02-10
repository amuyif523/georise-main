import { Role } from '@prisma/client';

export interface RegisterRequestBody {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role?: Role;
  agencyId?: number;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface PasswordResetRequestBody {
  identifier: string; // email or phone
}

export interface PasswordResetConfirmBody {
  token: string;
  password: string;
}

export interface AuthTokenPayload {
  userId: number;
  role: Role;
  tokenVersion?: number;
  agencyId?: number | null;
}
