import { Router } from "express";
import prisma from "../../prisma";

const router = Router();

router.get("/status", async (req, res) => {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "CRISIS_MODE" },
  });
  res.json({
    crisisMode: config?.value === "true",
  });
});

export default router;
