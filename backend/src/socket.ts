import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import prisma from "./prisma";
import logger from "./logger";
import { authService } from "./modules/auth/auth.service";
import { ResponderStatus } from "@prisma/client";

let io: Server | null = null;

export const initSocketServer = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
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
      const { userId, role } = payload;
      (socket as any).user = { id: userId, role };
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);

      try {
        const staff = await prisma.agencyStaff.findUnique({
          where: { userId },
          select: { agencyId: true },
        });
        if (staff?.agencyId) {
          socket.join(`agency:${staff.agencyId}`);
          logger.info({ userId, agencyId: staff.agencyId }, "Joined agency room");
        }
      } catch (err) {
        logger.error({ err }, "Failed joining agency room");
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
          const { lat, lng } = payload;
          const updated = await prisma.responder.update({
            where: { id: resp.id },
            data: { latitude: lat, longitude: lng, status: ResponderStatus.EN_ROUTE },
          });
          io?.to(`agency:${updated.agencyId}`).emit("responder:position", {
            responderId: updated.id,
            lat,
            lng,
          });
          // ETA + geofence
          const mod = await import("./modules/dispatch/dispatch.service.js");
          await mod.handleETAAndGeofence(updated.id);
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
