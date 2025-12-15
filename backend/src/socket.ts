import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import prisma from "./prisma";
import logger from "./logger";
import { authService } from "./modules/auth/auth.service";
import { ResponderStatus } from "@prisma/client";

let io: Server | null = null;

export const initSocketServer = (server: HttpServer) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.CLIENT_ORIGIN,
  ].filter(Boolean) as string[];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    logger.info({ socketId: socket.id }, "Socket connection");
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      logger.warn("Socket missing token; disconnecting");
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
        logger.info({ userId, agencyId }, "Joined agency room");
      } else {
        // Fallback for older tokens or if agencyId wasn't in payload
        try {
          const staff = await prisma.agencyStaff.findUnique({
            where: { userId },
            select: { agencyId: true },
          });
          if (staff?.agencyId) {
            socket.join(`agency:${staff.agencyId}`);
            logger.info({ userId, agencyId: staff.agencyId }, "Joined agency room (fallback)");
          }
        } catch (err) {
          logger.error({ err }, "Failed joining agency room");
        }
      }

      // Join responder room if linked
      try {
        const resp = await prisma.responder.findFirst({
          where: { userId },
          select: { id: true },
        });
        if (resp) {
          socket.join(`responder:${resp.id}`);
          logger.info({ userId, responderId: resp.id }, "Joined responder room");
        }
      } catch (err) {
        logger.error({ err }, "Failed joining responder room");
      }

      // Location updates from responder
      socket.on("responder:locationUpdate", async (payload) => {
        try {
          const resp = await prisma.responder.findFirst({ where: { userId } });
          if (!resp) return;
          const { lat, lng, status } = payload;
          
          const updateData: any = { latitude: lat, longitude: lng };
          if (status && Object.values(ResponderStatus).includes(status)) {
            updateData.status = status;
          }

          const updated = await prisma.responder.update({
            where: { id: resp.id },
            data: updateData,
          });
          
          if (updated.agencyId) {
             io?.to(`agency:${updated.agencyId}`).emit("responder:position", {
              responderId: updated.id,
              lat,
              lng,
              status: updated.status
            });
          }
        } catch (err) {
          logger.error({ err }, "responder:locationUpdate failed");
        }
      });

      socket.on("disconnect", () => {
        logger.info({ userId, socketId: socket.id }, "Socket disconnect");
      });
    } catch (err) {
      logger.error({ err }, "Socket auth failed");
      socket.disconnect();
    }
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};
