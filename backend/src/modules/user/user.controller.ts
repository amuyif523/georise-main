import { Request, Response } from "express";
import { userService } from "./user.service";

export const updateLocation = async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: "lat/lng required" });
  await userService.updateLocation(req.user!.id, Number(lat), Number(lng));
  res.json({ success: true });
};

export const getNotifications = async (req: Request, res: Response) => {
  const notifications = await userService.getNotifications(req.user!.id);
  res.json({ notifications });
};

export const markRead = async (req: Request, res: Response) => {
    const { id } = req.params;
    await userService.markRead(id, req.user!.id);
    res.json({ success: true });
}

export const markAllRead = async (req: Request, res: Response) => {
    await userService.markAllRead(req.user!.id);
    res.json({ success: true });
}
