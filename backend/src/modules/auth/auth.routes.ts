import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { login, me, register } from "./auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
