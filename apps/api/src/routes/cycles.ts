import { Router } from "express";
import { prisma, CycleStatus } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { triggerCyclePhase } from "../jobs/daily-cycle";
import { cacheMiddleware } from "../middleware/cache";

export const cycleRouter = Router();

// Valid phase transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  SUGGESTING: ["VOTING", "CANCELLED"],
  VOTING: ["BIDDING", "CANCELLED"],
  BIDDING: ["SOURCING", "CANCELLED"],
  SOURCING: ["ORDERING", "CANCELLED"],
  ORDERING: ["COMPLETED", "CANCELLED"],
};

// GET /today — get today's cycle for a zone
cycleRouter.get("/today", async (req, res, next) => {
  try {
    const zoneId = req.query.zoneId as string;
    if (!zoneId) throw new AppError("zoneId query param required", 400);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cycle = await prisma.dailyCycle.findUnique({
      where: { zoneId_date: { zoneId, date: today } },
      include: {
        dishes: {
          include: { ingredients: true },
          orderBy: { voteCount: "desc" },
        },
      },
    });

    if (!cycle) throw new AppError("No cycle found for today", 404);
    res.json({ success: true, data: cycle });
  } catch (err) {
    next(err);
  }
});

// GET /today/status — lightweight status check for today's cycle
cycleRouter.get("/today/status", cacheMiddleware(15, "cycle:status"), async (req, res, next) => {
  try {
    const zoneId = req.query.zoneId as string;
    if (!zoneId) throw new AppError("zoneId query param required", 400);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cycle = await prisma.dailyCycle.findUnique({
      where: { zoneId_date: { zoneId, date: today } },
      select: {
        id: true,
        status: true,
        date: true,
        winningDishId: true,
        winningBidId: true,
        _count: {
          select: { dishes: true, votes: true, bids: true, orders: true },
        },
      },
    });

    if (!cycle) throw new AppError("No cycle found for today", 404);
    res.json({ success: true, data: cycle });
  } catch (err) {
    next(err);
  }
});

// POST /transition — admin-only: manually advance a cycle phase
cycleRouter.post(
  "/transition",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { cycleId, targetStatus } = req.body;
      if (!cycleId || !targetStatus) {
        throw new AppError("cycleId and targetStatus are required", 400);
      }

      // Validate targetStatus is a valid CycleStatus
      if (!Object.values(CycleStatus).includes(targetStatus)) {
        throw new AppError(`Invalid status: ${targetStatus}`, 400);
      }

      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new AppError("Cycle not found", 404);

      // Check valid transition
      const allowed = VALID_TRANSITIONS[cycle.status];
      if (!allowed || !allowed.includes(targetStatus)) {
        throw new AppError(
          `Cannot transition from ${cycle.status} to ${targetStatus}`,
          400
        );
      }

      const updated = await triggerCyclePhase(cycleId, targetStatus as CycleStatus);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /create — admin-only: manually create today's cycle for a zone
cycleRouter.post(
  "/create",
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { zoneId } = req.body;
      if (!zoneId) throw new AppError("zoneId is required", 400);

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError("Zone not found", 404);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await prisma.dailyCycle.findUnique({
        where: { zoneId_date: { zoneId, date: today } },
      });
      if (existing) throw new AppError("Cycle already exists for today", 409);

      const cycle = await prisma.dailyCycle.create({
        data: { zoneId, date: today, status: "SUGGESTING" },
      });

      res.status(201).json({ success: true, data: cycle });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id — get cycle details
cycleRouter.get("/:id", async (req, res, next) => {
  try {
    const cycle = await prisma.dailyCycle.findUnique({
      where: { id: req.params.id },
      include: {
        dishes: {
          include: { ingredients: true },
          orderBy: { voteCount: "desc" },
        },
        zone: { select: { name: true, slug: true } },
      },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
    res.json({ success: true, data: cycle });
  } catch (err) {
    next(err);
  }
});

// GET /:id/summary — cycle summary with counts and winner info
cycleRouter.get("/:id/summary", async (req, res, next) => {
  try {
    const cycle = await prisma.dailyCycle.findUnique({
      where: { id: req.params.id },
      include: {
        zone: { select: { name: true } },
        dishes: { orderBy: { voteCount: "desc" }, take: 1, select: { name: true, voteCount: true } },
        bids: {
          where: { status: "WON" },
          take: 1,
          include: { restaurant: { select: { name: true } } },
        },
        _count: { select: { votes: true, bids: true, orders: true } },
      },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);

    res.json({
      success: true,
      data: {
        id: cycle.id,
        status: cycle.status,
        date: cycle.date,
        zoneName: cycle.zone.name,
        topDish: cycle.dishes[0] || null,
        winningBid: cycle.bids[0] || null,
        counts: cycle._count,
      },
    });
  } catch (err) {
    next(err);
  }
});
