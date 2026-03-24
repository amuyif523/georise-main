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

export interface CompleteOnboardingBody {
  newPassword: string;
}

export interface ResponderOnboardBody {
  token: string;
  password: string;
  biometricEnabled: boolean;
}

export interface AuthTokenPayload {
  userId: number;
  role: Role;
  tokenVersion?: number;
  agencyId?: number | null;
  mustChangePassword?: boolean;
}

export interface ResponderInviteTokenPayload {
  userId: number;
  responderId: number;
  agencyId: number;
  role: Role;
  tokenVersion: number;
  purpose: 'responder_onboard';
}
