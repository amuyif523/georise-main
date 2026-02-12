import webpush, { SendResult } from 'web-push';
import prisma from '../../prisma';
import logger from '../../logger';
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../../config/env';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

class PushService {
  private configured = false;

  private ensureConfigured() {
    if (this.configured) return true;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      logger.warn('VAPID keys missing; push notifications disabled');
      return false;
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    this.configured = true;
    return true;
  }

  async saveSubscription(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        isActive: true,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async sendToUsers(userIds: number[], payload: PushPayload) {
    if (!userIds.length || !this.ensureConfigured()) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds }, isActive: true },
    });

    const send = subscriptions.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        const result = (await webpush.sendNotification(
          subscription,
          JSON.stringify(payload),
        )) as SendResult;
        return result;
      } catch (err: unknown) {
        logger.warn({ err, endpoint: sub.endpoint }, 'Push send failed');
        const status =
          err && typeof err === 'object' && 'statusCode' in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.update({
            where: { endpoint: sub.endpoint },
            data: { isActive: false },
          });
        }
        return null;
      }
    });

    await Promise.all(send);
  }

  async notifyAssignment(incident: any, responderId: number) {
    try {
      const payload = {
        title: 'New Incident Assigned',
        body: `You have been assigned to: ${incident.title}`,
        data: {
          url: `/agency/map?incidentId=${incident.id}`,
          incidentId: incident.id,
        },
      };
      await this.sendToUsers([responderId], payload);
    } catch (error) {
      console.error('Failed to send assignment push:', error);
    }
  }
}

export const pushService = new PushService();
