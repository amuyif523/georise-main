import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { login, me, register } from "./auth.controller";
import { validateBody } from "../../middleware/validate";
import { loginSchema, registerSchema } from "./auth.validation";
import refreshRouter from "./refresh.routes";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", requireAuth, me);
router.use("/", refreshRouter);

export default router;
