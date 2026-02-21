import { Router } from "express";
import { prisma } from "@dotted/db";
import { castVoteSchema } from "@dotted/shared";
import { authenticate, requireVerified } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import { getIO } from "../socket/handlers";
import { getSubscriptionLimits } from "../services/subscription";
import { recordPreferenceSignal } from "../services/personalization";
import { addLoyaltyPoints } from "../services/gamification";

export const voteRouter = Router();

voteRouter.post("/", authenticate, requireVerified, validate(castVoteSchema), async (req, res, next) => {
  try {
    const { dishId, dailyCycleId } = req.body;
    const userId = req.user!.userId;

    // Verify cycle is in VOTING status
    const cycle = await prisma.dailyCycle.findUnique({ where: { id: dailyCycleId } });
    if (!cycle) throw new AppError("Cycle not found", 404);
    if (cycle.status !== "VOTING") throw new AppError("Voting is not open for this cycle", 400);

    // Verify dish belongs to cycle
    const dish = await prisma.dish.findFirst({ where: { id: dishId, dailyCycleId } });
    if (!dish) throw new AppError("Dish not found in this cycle", 404);

    // Check if user already voted (unique constraint — always check first)
    const existing = await prisma.vote.findUnique({
      where: { userId_dailyCycleId: { userId, dailyCycleId } },
    });
    if (existing) throw new AppError("You have already voted in this cycle", 409);

    // Check subscription tier votesPerCycle limit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });
    const limits = getSubscriptionLimits(user?.subscriptionTier ?? "FREE");
    const voteCount = await prisma.vote.count({
      where: { userId, dailyCycleId },
    });
    if (voteCount >= limits.votesPerCycle) {
      throw new AppError(`Vote limit reached (${limits.votesPerCycle}). Upgrade your subscription for more votes.`, 429);
    }

    // Create vote and increment dish vote count
    const [vote] = await prisma.$transaction([
      prisma.vote.create({ data: { userId, dishId, dailyCycleId } }),
      prisma.dish.update({ where: { id: dishId }, data: { voteCount: { increment: 1 } } }),
    ]);

    // Record preference signal
    recordPreferenceSignal(userId, {
      signalType: "VOTE",
      dishName: dish.name,
      cuisine: dish.cuisine,
      tags: ((dish.recipeSpec as Record<string, unknown>)?.tags as string[]) ?? [],
    }).catch(() => {});

    // Loyalty points for voting
    addLoyaltyPoints(userId, 2, "vote").catch(() => {});

    // Emit real-time update
    const updatedDish = await prisma.dish.findUnique({ where: { id: dishId } });
    const totalVotes = await prisma.vote.count({ where: { dailyCycleId } });

    getIO()?.to(`cycle:${dailyCycleId}`).emit("vote:update", {
      cycleId: dailyCycleId,
      dishId,
      voteCount: updatedDish!.voteCount,
      totalVotes,
    });

    res.status(201).json({ success: true, data: vote });
  } catch (err) {
    next(err);
  }
});

voteRouter.get("/live/:cycleId", async (req, res, next) => {
  try {
    const dishes = await prisma.dish.findMany({
      where: { dailyCycleId: req.params.cycleId },
      select: { id: true, name: true, voteCount: true },
      orderBy: { voteCount: "desc" },
    });
    const totalVotes = dishes.reduce((sum, d) => sum + d.voteCount, 0);
    res.json({ success: true, data: { dishes, totalVotes } });
  } catch (err) {
    next(err);
  }
});
