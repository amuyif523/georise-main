import { ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

export const validateBody =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
