import prisma from '../../prisma';
import { smsService } from '../sms/sms.service';
import { pushService } from '../push/push.service';
import { getIO } from '../../socket';
import logger from '../../logger';

export type NotificationOptions = {
  userId: number;
  title: string;
  message: string;
  type: string;
  data?: any;
  channels: ('SMS' | 'PUSH' | 'IN_APP')[];
};

export class NotificationService {
  async send(options: NotificationOptions) {
    const { userId, title, message, type, data, channels } = options;

    logger.info({ userId, type, channels }, 'Preparing to send notification');

    // 1. IN_APP / SOCKET (Real-time)
    if (channels.includes('IN_APP')) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            title,
            message,
            type,
            data,
          },
        });

        const io = getIO();
        io.to(`user:${userId}`).emit('notification:new', {
          title,
          message,
          type,
          data,
        });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to create in-app notification');
      }
    }

    // 2. WEB PUSH
    if (channels.includes('PUSH')) {
      await pushService.sendToUsers([userId], {
        title,
        body: message,
        data: { ...data, url: this.getDeepLink(type, data) },
      });
    }

    // 3. SMS (Critical or specifically requested)
    if (channels.includes('SMS')) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      if (user?.phone) {
        await smsService.sendSMS(user.phone, `${title}: ${message}`);
      }
    }
  }

  private getDeepLink(type: string, data: any): string {
    if (type === 'PROXIMITY_ALERT') return '/citizen/my-reports';
    if (data?.incidentId) return `/agency/incidents/${data.incidentId}`;
    return '/';
  }
}

export const notificationService = new NotificationService();
