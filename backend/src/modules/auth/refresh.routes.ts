import { Router } from "express";
import { authService } from "./auth.service";
import { validateBody } from "../../middleware/validate";
import { refreshSchema } from "./auth.validation";
import logger from "../../logger";

const router = Router();

router.post("/refresh", validateBody(refreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.rotateRefresh(refreshToken);
    
    const agencyId = result.user.agencyStaff?.agencyId || null;

    res.json({
      token: result.access,
      refreshToken: result.refresh,
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
        agencyId,
        trustScore: result.user.trustScore ?? 0,
        totalReports: result.user.totalReports ?? 0,
        validReports: result.user.validReports ?? 0,
        rejectedReports: result.user.rejectedReports ?? 0,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Refresh token error");
    return res.status(401).json({ message: err?.message || "Invalid refresh token" });
  }
});

export default router;
