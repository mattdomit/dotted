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

// GET /users — list all users with pagination
adminRouter.get(
  "/users",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const role = req.query.role as string | undefined;

      const where = role ? { role: role as UserRole } : {};
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: { id: true, email: true, name: true, role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      res.json({ success: true, data: { users, total, page, limit } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /zones — list all zones with member counts
adminRouter.get(
  "/zones",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (_req, res, next) => {
    try {
      const zones = await prisma.zone.findMany({
        include: {
          _count: {
            select: { memberships: true, restaurants: true, suppliers: true, dailyCycles: true },
          },
        },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: zones });
    } catch (err) {
      next(err);
    }
  }
);

// POST /zones — create a new zone
adminRouter.post(
  "/zones",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { name, slug, city, state } = req.body;
      if (!name || !slug || !city || !state) {
        throw new AppError("name, slug, city, and state are required", 400);
      }
      const zone = await prisma.zone.create({
        data: { name, slug, city, state },
      });
      res.status(201).json({ success: true, data: zone });
    } catch (err) {
      next(err);
    }
  }
);

// GET /revenue — revenue analytics
adminRouter.get(
  "/revenue",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (_req, res, next) => {
    try {
      const totalRevenue = await prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: { in: ["CONFIRMED", "READY", "PICKED_UP", "DELIVERED"] } },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayRevenue = await prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: {
          status: { in: ["CONFIRMED", "READY", "PICKED_UP", "DELIVERED"] },
          createdAt: { gte: todayStart },
        },
      });

      const recentOrders = await prisma.order.findMany({
        where: { status: { in: ["CONFIRMED", "READY", "PICKED_UP", "DELIVERED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          restaurant: { select: { name: true } },
          user: { select: { name: true } },
        },
      });

      res.json({
        success: true,
        data: {
          totalRevenue: totalRevenue._sum.totalPrice || 0,
          todayRevenue: todayRevenue._sum.totalPrice || 0,
          recentOrders,
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
