import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import prisma from './prisma';
import logger from './logger';
import { authService } from './modules/auth/auth.service';
import { ResponderStatus } from '@prisma/client';
import redis from './redis';

let io: Server | null = null;

export const initSocketServer = (server: HttpServer) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_ORIGIN,
  ].filter(Boolean) as string[];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', async (socket) => {
    logger.info({ socketId: socket.id }, 'Socket connection');
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      logger.warn('Socket missing token; disconnecting');
      socket.disconnect();
      return;
    }
    try {
      const payload = authService.verifyToken(token);
      const { userId, role, agencyId } = payload;
      (socket as any).user = { id: userId, role, agencyId };
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);

      if (agencyId) {
        socket.join(`agency:${agencyId}`);
        logger.info({ userId, agencyId }, 'Joined agency room');
      }

      // Incident Chat Rooms
      socket.on('join_incident', (incidentId: number) => {
        socket.join(`incident:${incidentId}`);
        logger.info({ userId, incidentId }, 'Joined incident room');
      });

      socket.on('leave_incident', (incidentId: number) => {
        socket.leave(`incident:${incidentId}`);
      });

      // Join responder room if linked
      try {
        const resp = await prisma.responder.findFirst({
          where: { userId },
          select: { id: true, agencyId: true },
        });
        if (resp) {
          (socket as any).responderId = resp.id;
          (socket as any).responderAgencyId = resp.agencyId;
          socket.join(`responder:${resp.id}`);
          logger.info({ userId, responderId: resp.id }, 'Joined responder room');
        }
      } catch (err) {
        logger.error({ err }, 'Failed joining responder room');
      }

      // Location updates from responder
      socket.on('responder:locationUpdate', async (payload) => {
        try {
          const responderId = (socket as any).responderId;
          const agencyId = (socket as any).responderAgencyId;

          if (!responderId) return; // Not a responder

          const { lat, lng, status } = payload;

          // Write-Behind: Save to Redis
          const data = {
            lat,
            lng,
            status: status && Object.values(ResponderStatus).includes(status) ? status : undefined,
            updatedAt: Date.now(),
          };

          await redis.hset('responder:locations', String(responderId), JSON.stringify(data));

          // Real-time emit to agency
          if (agencyId) {
            io?.to(`agency:${agencyId}`).emit('responder:position', {
              responderId,
              lat,
              lng,
              status: data.status,
            });
          }
        } catch (err) {
          logger.error({ err }, 'responder:locationUpdate failed');
        }
      });

      socket.on('disconnect', () => {
        logger.info({ userId, socketId: socket.id }, 'Socket disconnect');
      });
    } catch (err) {
      logger.error({ err }, 'Socket auth failed');
      socket.disconnect();
    }
  });
};

// Background Worker: Sync Redis locations to DB every 30 seconds
setInterval(async () => {
  try {
    const locations = (await redis.hgetall('responder:locations')) as Record<string, string>;
    const updates = Object.entries(locations);
    if (updates.length === 0) return;

    // Process in chunks or parallel
    await prisma.$transaction(
      updates.map(([idStr, jsonStr]) => {
        const id = Number(idStr);
        const data = JSON.parse(jsonStr);
        // Only update if data is valid
        const updateData: any = { latitude: data.lat, longitude: data.lng };
        if (data.status) updateData.status = data.status;

        return prisma.responder.update({
          where: { id },
          data: updateData,
        });
      }),
    );

    // Optional: Clear or expire? No, we keep it as latest state.
    // Ideally we track "lastSynced" or just overwrite. Overwriting is safe.
  } catch (err) {
    logger.error({ err }, 'Failed to sync responder locations');
  }
}, 30000); // 30 seconds

export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
