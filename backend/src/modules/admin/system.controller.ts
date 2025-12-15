import { Request, Response } from "express";
import { SystemConfig } from "@prisma/client";
import prisma from "../../prisma";
import { getIO } from "../../socket";
import { z } from "zod";

export const getSystemConfig = async (req: Request, res: Response) => {
  const configs = await prisma.systemConfig.findMany();
  const configMap = configs.reduce((acc: Record<string, string>, curr: SystemConfig) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);
  res.json({ config: configMap });
};

export const updateSystemConfig = async (req: Request, res: Response) => {
  const schema = z.object({
    key: z.string(),
    value: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

  const { key, value } = parsed.data;

  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  // Emit event if crisis mode changes
  if (key === "CRISIS_MODE") {
    const io = getIO();
    io.emit("system:config", { key, value });
  }

  res.json({ config });
};

export const sendBroadcast = async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(5),
    targetGeoJSON: z.string().optional(), // GeoJSON Polygon string
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

  const { message, targetGeoJSON } = parsed.data;

  // Save log
  if (targetGeoJSON) {
    await prisma.$executeRaw`
      INSERT INTO "BroadcastLog" (message, "targetArea", "sentBy", "sentAt")
      VALUES (${message}, ST_SetSRID(ST_GeomFromGeoJSON(${targetGeoJSON}), 4326), ${req.user!.id}, NOW());
    `;
  } else {
    await prisma.broadcastLog.create({
      data: {
        message,
        sentBy: req.user!.id,
      },
    });
  }

  // Emit to all connected clients
  const io = getIO();
  io.emit("system:broadcast", {
    message,
    targetGeoJSON: targetGeoJSON ? JSON.parse(targetGeoJSON) : null,
    sentAt: new Date(),
  });

  res.json({ success: true });
};
