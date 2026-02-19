import { Router } from "express";
import { UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { generateDishSuggestions } from "../ai/dish-generator";
import { optimizeSourcing } from "../ai/supplier-matcher";
import { AppError } from "../middleware/error-handler";

export const aiRouter = Router();

aiRouter.post(
  "/suggest-dishes",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { zoneId, cycleId } = req.body;
      if (!zoneId || !cycleId) throw new AppError("zoneId and cycleId required", 400);

      const dishes = await generateDishSuggestions(zoneId, cycleId);
      res.json({ success: true, data: dishes });
    } catch (err) {
      next(err);
    }
  }
);

aiRouter.post(
  "/optimize-sourcing",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { cycleId } = req.body;
      if (!cycleId) throw new AppError("cycleId required", 400);

      const plan = await optimizeSourcing(cycleId);
      res.json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }
);
