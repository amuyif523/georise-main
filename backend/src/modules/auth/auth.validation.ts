import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8).max(100),
  role: z.enum(['CITIZEN', 'AGENCY_STAFF', 'ADMIN', 'RESPONDER']).optional(),
  agencyId: z.number().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  clientSource: z.enum(['DASHBOARD', 'RESPONDER_APP']).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().min(3),
});

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(6).max(64).optional(),
    code: z.string().min(6).max(64).optional(),
    password: z.string().min(8).max(100),
  })
  .refine((data) => Boolean(data.token || data.code), {
    message: 'Reset token or code is required',
    path: ['token'],
  })
  .transform((data) => ({
    token: (data.token ?? data.code ?? '').trim(),
    password: data.password,
  }));

export const completeOnboardingSchema = z.object({
  newPassword: z.string().min(8).max(100),
});

export const responderOnboardSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(100),
  biometricEnabled: z.literal(true),
});
