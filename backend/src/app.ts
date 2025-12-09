import cors from "cors";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes";
import incidentRoutes from "./modules/incident/incident.routes";
import adminRoutes from "./modules/admin/admin.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import gisRoutes from "./modules/gis/gis.routes";
import verificationRoutes from "./modules/verification/verification.routes";
import responderRoutes from "./modules/responders/responder.routes";
import dispatchRoutes from "./modules/dispatch/dispatch.routes";
import demoRoutes from "./modules/demo/demo.routes";
import logger from "./logger";

const app = express();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use(globalLimiter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "georise-backend" });
});

// Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again later." },
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gis", gisRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/responders", responderRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/demo", demoRoutes);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, stack: err?.stack }, "Unhandled error");
  res.status(err?.status || 500).json({ message: "Internal server error" });
});

export default app;
