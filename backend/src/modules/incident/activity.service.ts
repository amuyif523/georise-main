import prisma from '../../prisma';
import { ActivityType } from '@prisma/client';

export const logActivity = async (
  incidentId: number,
  type: ActivityType,
  message: string,
  userId?: number,
) => {
  await prisma.activityLog.create({
    data: {
      incidentId,
      type,
      message,
      userId: userId ?? null,
    },
  });
};
