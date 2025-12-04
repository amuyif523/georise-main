import cors from "cors";
import express from "express";
import authRoutes from "./modules/auth/auth.routes";
import incidentRoutes from "./modules/incident/incident.routes";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "georise-backend" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/incidents", incidentRoutes);

export default app;
