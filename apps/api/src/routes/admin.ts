import { Router } from "express";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { triggerCyclePhase } from "../jobs/daily-cycle";
import { cacheMiddleware } from "../middleware/cache";

export const adminRouter = Router();

adminRouter.get(
  "/analytics",
  authenticate,
  requireRole(UserRole.ADMIN),
  cacheMiddleware(60, "admin:analytics"),
  async (_req, res, next) => {
    try {
      const [users, restaurants, suppliers, cycles, orders] = await Promise.all([
        prisma.user.count(),
        prisma.restaurant.count(),
        prisma.supplier.count(),
        prisma.dailyCycle.count(),
        prisma.order.count(),
      ]);

      const todaysCycles = await prisma.dailyCycle.findMany({
        where: { date: new Date(new Date().toISOString().split("T")[0]) },
        include: { _count: { select: { votes: true, bids: true, orders: true } } },
      });

      res.json({
        success: true,
        data: {
          totals: { users, restaurants, suppliers, cycles, orders },
          today: todaysCycles,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.post(
  "/cycles/override",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { cycleId, action } = req.body;
      if (!cycleId || !action) throw new AppError("cycleId and action required", 400);

      const validActions: CycleStatus[] = [
        CycleStatus.VOTING,
        CycleStatus.BIDDING,
        CycleStatus.SOURCING,
        CycleStatus.ORDERING,
        CycleStatus.COMPLETED,
        CycleStatus.CANCELLED,
      ];
      if (!validActions.includes(action)) {
        throw new AppError(`Invalid action. Must be one of: ${validActions.join(", ")}`, 400);
      }

      const result = await triggerCyclePhase(cycleId, action);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);
