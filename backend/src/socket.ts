import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import prisma from "./prisma";
import logger from "./logger";
import { authService } from "./modules/auth/auth.service";

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
