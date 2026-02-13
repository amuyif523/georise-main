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
    'http://localhost:4173',
    'http://localhost:4174',
    process.env.CLIENT_ORIGIN,
  ].filter(Boolean) as string[];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'], // Allow graceful upgrade
  });

  io.on('connection', async (socket) => {
    logger.info(
      {
        socketId: socket.id,
        transport: socket.conn.transport.name,
        query: socket.handshake.query,
      },
      'Socket connection attempt',
    );

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
        socket.emit('room:joined', { room: `incident:${incidentId}` });
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

          try {
            await redis.hset('responder:locations', String(responderId), JSON.stringify(data));
          } catch (redisErr) {
            logger.error({ err: redisErr }, 'Failed to save responder location to Redis');
          }

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
      socket.emit('auth_error', { message: 'Authentication failed' }); // Notify client
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
    // Process updates individually to avoid one failure blocking all
    await Promise.all(
      updates.map(async ([idStr, jsonStr]) => {
        try {
          const id = Number(idStr);
          const data = JSON.parse(jsonStr);

          const updateData: any = {
            latitude: data.lat,
            longitude: data.lng,
            lastSeenAt: new Date(data.updatedAt),
          };
          if (data.status) updateData.status = data.status;

          await prisma.responder.update({
            where: { id },
            data: updateData,
          });
        } catch (err: any) {
          if (err.code === 'P2025') {
            // Record not found in DB but exists in Redis (Stale data)
            // Remove from Redis to stop future errors
            await redis.hdel('responder:locations', idStr);
            logger.warn({ id: idStr }, 'Removed stale responder from Redis sync');
          } else {
            logger.error({ err, id: idStr }, 'Failed to update responder location');
          }
        }
      }),
    );
  } catch (err) {
    logger.error({ err }, 'Failed to sync responder locations (Critical Job Error)');
  }
}, 30000); // 30 seconds

export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
