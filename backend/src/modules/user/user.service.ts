import prisma from "../../prisma";

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
      take: 50
    });
  }
  
  async markRead(notificationId: string, userId: number) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true }
    });
  }
  
  async markAllRead(userId: number) {
      return prisma.notification.updateMany({
          where: { userId, isRead: false },
          data: { isRead: true }
      });
  }
}

export const userService = new UserService();
