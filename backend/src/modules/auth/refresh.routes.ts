import { Router } from "express";
import { authService } from "./auth.service";
import { validateBody } from "../../middleware/validate";
import { refreshSchema } from "./auth.validation";

const router = Router();

router.post("/refresh", validateBody(refreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.rotateRefresh(refreshToken);
    res.json({
      token: result.access,
      refreshToken: result.refresh,
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (err: any) {
    return res.status(401).json({ message: err?.message || "Invalid refresh token" });
  }
});

export default router;
