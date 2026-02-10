import { Request, Response } from 'express';
import { pushService } from './push.service';
import logger from '../../logger';

export const subscribe = async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    await pushService.saveSubscription(req.user!.id, subscription);
    return res.status(201).json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Push subscription failed');
    return res.status(500).json({ message: 'Failed to subscribe' });
  }
};
