import "dotenv/config";
import http from "http";
import app from "./app";
import { initSocketServer } from "./socket";
import { initSLAJob } from "./jobs/sla.job";

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocketServer(server);
initSLAJob();

server.listen(PORT, () => {
  console.log(`Backend API + Socket running on http://localhost:${PORT}`);
});
