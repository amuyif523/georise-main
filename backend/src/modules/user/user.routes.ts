import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { updateLocation, getNotifications, markRead, markAllRead } from "./user.controller";

const router = Router();

router.post("/location", requireAuth, updateLocation);
router.get("/notifications", requireAuth, getNotifications);
router.put("/notifications/read-all", requireAuth, markAllRead);
router.put("/notifications/:id/read", requireAuth, markRead);

export default router;
