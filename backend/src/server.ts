import 'dotenv/config';
import prisma from './prisma';
import http from 'http';
import app from './app';
import { initSocketServer } from './socket';
import { initSLAJob } from './jobs/sla.job';
import { initHeartbeatJob } from './jobs/heartbeat.job';
import { stopResponderSimulation } from './jobs/responderSimulation.job';
import './jobs/aiWorker'; // Start the worker

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocketServer(server);
initSLAJob();
initHeartbeatJob();
// Ensure simulation is not running on boot; it can be started via /demo endpoints
stopResponderSimulation();

import { ensureTestAgency } from './utils/seed-helper';
server.listen(PORT, async () => {
  try {
    console.log('Initializing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    await ensureTestAgency();

    console.log(`Backend API + Socket running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
  } catch (err) {
    console.error('CRITICAL: Database connection failed during boot:', err);
    process.exit(1);
  }
});
