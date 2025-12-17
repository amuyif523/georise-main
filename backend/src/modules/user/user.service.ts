import prisma from '../../prisma';

export class UserService {
  async updateLocation(userId: number, lat: number, lng: number) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "lastLatitude" = ${lat},
          "lastLongitude" = ${lng},
          "location" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE id = ${userId}
    `;
  }

  async getNotifications(userId: number) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: number) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async savePushSubscription(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    const { endpoint, keys } = subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid push subscription');
    }

    return prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, isActive: true },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        isActive: true,
      },
    });
  }

  async deactivatePushSubscription(userId: number, endpoint: string) {
    return prisma.pushSubscription.updateMany({
      where: { userId, endpoint },
      data: { isActive: false },
    });
  }
}

export const userService = new UserService();
