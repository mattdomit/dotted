import { Router } from "express";
import { prisma } from "@dotted/db";
import { submitBidSchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import { getIO } from "../socket/handlers";

export const bidRouter = Router();

bidRouter.post(
  "/",
  authenticate,
  requireRole(UserRole.RESTAURANT_OWNER),
  validate(submitBidSchema),
  async (req, res, next) => {
    try {
      const { restaurantId, dailyCycleId, dishId, pricePerPlate, prepTime, maxCapacity, serviceFeeAccepted } = req.body;

      // Verify cycle is in BIDDING status
      const cycle = await prisma.dailyCycle.findUnique({ where: { id: dailyCycleId } });
      if (!cycle) throw new AppError("Cycle not found", 404);
      if (cycle.status !== "BIDDING") throw new AppError("Bidding is not open", 400);

      // Verify restaurant belongs to user
      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant || restaurant.ownerId !== req.user!.userId) {
        throw new AppError("Not your restaurant", 403);
      }

      // Check existing bid
      const existing = await prisma.bid.findUnique({
        where: { restaurantId_dailyCycleId: { restaurantId, dailyCycleId } },
      });
      if (existing) throw new AppError("Already submitted a bid for this cycle", 409);

      const bid = await prisma.bid.create({
        data: { restaurantId, dailyCycleId, dishId, pricePerPlate, prepTime, maxCapacity, serviceFeeAccepted },
      });

      // Emit real-time update
      const bidCount = await prisma.bid.count({ where: { dailyCycleId } });
      getIO()?.to(`cycle:${dailyCycleId}`).emit("bid:update", { cycleId: dailyCycleId, bidCount });

      res.status(201).json({ success: true, data: bid });
    } catch (err) {
      next(err);
    }
  }
);

bidRouter.get("/:cycleId", authenticate, async (req, res, next) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { dailyCycleId: req.params.cycleId as string },
      include: { restaurant: { select: { name: true, rating: true, capacity: true } } },
      orderBy: { score: { sort: "desc", nulls: "last" } },
    });
    res.json({ success: true, data: bids });
  } catch (err) {
    next(err);
  }
});

bidRouter.get("/:cycleId/winner", async (req, res, next) => {
  try {
    const bid = await prisma.bid.findFirst({
      where: { dailyCycleId: req.params.cycleId as string, status: "WON" },
      include: { restaurant: { select: { name: true, address: true, rating: true } } },
    });
    if (!bid) throw new AppError("No winning bid yet", 404);
    res.json({ success: true, data: bid });
  } catch (err) {
    next(err);
  }
});
