import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { demoService } from './demo.service';
import prisma from '../../prisma';
import { Role } from '@prisma/client';
import {
  responderSimulationStatus,
  startResponderSimulation,
  stopResponderSimulation,
} from '../../jobs/responderSimulation.job';

const router = Router();

router.post('/reset', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  try {
    await demoService.resetDemoData();
    res.json({ message: 'Demo data cleared.' });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to reset demo data' });
  }
});

router.post('/start', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  try {
    const result = await demoService.seedAddisScenario1();
    res.json({ message: 'Demo scenario seeded.', result });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to start demo scenario' });
  }
});

router.get('/status', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const countInc = await prisma.incident.count({ where: { isDemo: true } });
  const countUnits = await prisma.responder.count({ where: { isDemo: true } });
  res.json({
    hasDemoData: countInc > 0 || countUnits > 0,
    demoCode: countInc > 0 ? 'ADDIS_SCENARIO_1' : null,
  });
});

router.post('/simulation/start', requireAuth, requireRole([Role.ADMIN]), (_req, res) => {
  const result = startResponderSimulation();
  res.json({ message: 'Responder simulation started', ...result });
});

router.post('/simulation/stop', requireAuth, requireRole([Role.ADMIN]), (_req, res) => {
  const result = stopResponderSimulation();
  res.json({ message: 'Responder simulation stopped', ...result });
});

router.get('/simulation/status', requireAuth, requireRole([Role.ADMIN]), (_req, res) => {
  res.json(responderSimulationStatus());
});

export default router;
