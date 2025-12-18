import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(6).max(100),
  role: z.enum(['CITIZEN', 'AGENCY_STAFF', 'ADMIN']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
