import { z } from 'zod';

export const createIncidentSchema = z.object({
  title: z.string().min(5).max(150),
  description: z.string().min(10).max(2000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isReporterAtScene: z.boolean().optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
