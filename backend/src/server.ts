import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocketServer } from './socket';
import { initSLAJob } from './jobs/sla.job';
import { stopResponderSimulation } from './jobs/responderSimulation.job';
import './jobs/aiWorker'; // Start the worker

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocketServer(server);
initSLAJob();
// Ensure simulation is not running on boot; it can be started via /demo endpoints
stopResponderSimulation();

server.listen(PORT, () => {
  console.log(`Backend API + Socket running on http://localhost:${PORT}`);
});
