import { Request, Response } from 'express';
import { userService } from './user.service';

export const updateLocation = async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined)
    return res.status(400).json({ message: 'lat/lng required' });
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
};

export const markAllRead = async (req: Request, res: Response) => {
  await userService.markAllRead(req.user!.id);
  res.json({ success: true });
};

export const savePushSubscription = async (req: Request, res: Response) => {
  const { subscription } = req.body as {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  };
  if (!subscription) return res.status(400).json({ message: 'subscription required' });
  await userService.savePushSubscription(req.user!.id, subscription);
  res.json({ success: true });
};

export const removePushSubscription = async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ message: 'endpoint required' });
  await userService.deactivatePushSubscription(req.user!.id, endpoint);
  res.json({ success: true });
};
