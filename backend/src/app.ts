import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import authRoutes from './modules/auth/auth.routes';
import incidentRoutes from './modules/incident/incident.routes';
import adminRoutes from './modules/admin/admin.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import gisRoutes from './modules/gis/gis.routes';
import verificationRoutes from './modules/verification/verification.routes';
import responderRoutes from './modules/responders/responder.routes';
import dispatchRoutes from './modules/dispatch/dispatch.routes';
import demoRoutes from './modules/demo/demo.routes';
import userRoutes from './modules/user/user.routes';
import systemRoutes from './modules/system/system.routes';
import logger from './logger';

const app = express();

// Middlewares
app.use(helmet());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.CLIENT_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Global rate limiter
app.use(apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'georise-backend' });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/responders', responderRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, stack: err?.stack }, 'Unhandled error');
  res.status(err?.status || 500).json({ message: 'Internal server error' });
});

export default app;
