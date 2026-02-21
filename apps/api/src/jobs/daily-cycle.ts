import cron from "node-cron";
import { prisma, CycleStatus } from "@dotted/db";
import { ACTIVITY_LEVELS } from "@dotted/shared";
import { generateDishSuggestions } from "../ai/dish-generator";
import { tallyVotes } from "../services/voting";
import { scoreBidsAndSelectWinner } from "../services/bidding";
import { optimizeSourcing } from "../ai/supplier-matcher";
import { checkAndAwardAchievements } from "../services/gamification";
import { getIO } from "../socket/handlers";
import { cacheInvalidate } from "../lib/redis";
import { notify } from "../services/notifications";
import { enqueueCyclePhase } from "../lib/queue";
import { logger } from "../lib/logger";

function emitCycleUpdate(cycleId: string, status: string) {
  getIO()?.to(`cycle:${cycleId}`).emit("cycle:status", { cycleId, status });
}

export async function triggerCyclePhase(cycleId: string, targetStatus: CycleStatus) {
  const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Cycle not found");

  switch (targetStatus) {
    case CycleStatus.VOTING: {
      // Generate dishes via AI then open voting
      await generateDishSuggestions(cycle.zoneId, cycleId);
      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: { status: "VOTING", actualVotingStart: new Date() },
      });
      emitCycleUpdate(cycleId, "VOTING");
      logger.info({ cycleId }, "Voting opened");

      // Notify zone members that voting is open
      const voteMembers = await prisma.zoneMembership.findMany({
        where: { zoneId: cycle.zoneId },
        select: { userId: true },
      });
      for (const m of voteMembers) {
        notify({
          userId: m.userId,
          type: "CYCLE_PHASE",
          title: "Voting is Open!",
          body: "Today's dish options are ready. Cast your vote now!",
          channels: ["IN_APP"],
        }).catch(() => {});
      }
      break;
    }

    case CycleStatus.BIDDING: {
      // Tally votes, declare winner, open bidding
      const voteResult = await tallyVotes(cycleId);
      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: { status: "BIDDING", actualVotingEnd: new Date() },
      });
      emitCycleUpdate(cycleId, "BIDDING");
      logger.info({ cycleId, winningDish: voteResult.winningDishName }, "Bidding opened");
      break;
    }

    case CycleStatus.SOURCING: {
      // Score bids, select winner, start sourcing
      const bidResult = await scoreBidsAndSelectWinner(cycleId);
      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: { status: "SOURCING", actualBiddingEnd: new Date() },
      });
      emitCycleUpdate(cycleId, "SOURCING");
      logger.info({ cycleId, restaurant: bidResult.restaurantName }, "Sourcing started");

      // Generate purchase orders
      await optimizeSourcing(cycleId);
      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: { actualSourcingEnd: new Date() },
      });
      logger.info({ cycleId }, "Purchase orders created");
      break;
    }

    case CycleStatus.ORDERING: {
      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: { status: "ORDERING", actualOrderingStart: new Date() },
      });
      emitCycleUpdate(cycleId, "ORDERING");
      logger.info({ cycleId }, "Orders open");

      // Notify zone members that ordering is open
      const orderMembers = await prisma.zoneMembership.findMany({
        where: { zoneId: cycle.zoneId },
        select: { userId: true },
      });
      for (const m of orderMembers) {
        notify({
          userId: m.userId,
          type: "CYCLE_PHASE",
          title: "Orders are Open!",
          body: "The winning dish is ready to order. Place your order now!",
          channels: ["IN_APP"],
        }).catch(() => {});
      }
      break;
    }

    case CycleStatus.COMPLETED: {
      // Compute post-cycle stats
      const orders = await prisma.order.findMany({
        where: { dailyCycleId: cycleId, status: { not: "CANCELLED" } },
        select: { totalPrice: true, userId: true },
      });
      const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0);
      const totalOrders = orders.length;

      // Waste percentage: sourced cost vs actual revenue
      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: { dailyCycleId: cycleId },
        select: { totalCost: true },
      });
      const sourcedCost = purchaseOrders.reduce((s, po) => s + po.totalCost, 0);
      const wastePercentage = sourcedCost > 0
        ? Math.max(0, ((sourcedCost - totalRevenue) / sourcedCost) * 100)
        : 0;

      // Average quality score for this cycle
      const qualityAgg = await prisma.qualityScore.aggregate({
        where: { dailyCycleId: cycleId },
        _avg: { overall: true },
      });

      await prisma.dailyCycle.update({
        where: { id: cycleId },
        data: {
          status: "COMPLETED",
          actualOrderingEnd: new Date(),
          totalRevenue,
          totalOrders,
          wastePercentage,
          avgQualityScore: qualityAgg._avg.overall,
        },
      });
      emitCycleUpdate(cycleId, "COMPLETED");
      logger.info({ cycleId, totalRevenue, totalOrders }, "Cycle completed");

      // Trigger achievements for participants
      const participantIds = new Set(orders.map((o) => o.userId));
      const voters = await prisma.vote.findMany({
        where: { dailyCycleId: cycleId },
        select: { userId: true },
      });
      for (const v of voters) participantIds.add(v.userId);

      for (const userId of participantIds) {
        checkAndAwardAchievements(userId).catch(() => {});
      }

      // Update zone activity level based on recent performance
      const recentCycles = await prisma.dailyCycle.findMany({
        where: { zoneId: cycle.zoneId, status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 7,
        select: { totalOrders: true },
      });
      const avgOrders = recentCycles.length > 0
        ? recentCycles.reduce((s, c) => s + (c.totalOrders ?? 0), 0) / recentCycles.length
        : 0;
      const newActivityLevel = avgOrders > 50 ? "HIGH" : avgOrders > 20 ? "MEDIUM" : "LOW";
      await prisma.zone.update({
        where: { id: cycle.zoneId },
        data: { activityLevel: newActivityLevel },
      });

      break;
    }

    case CycleStatus.CANCELLED: {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "CANCELLED" } });
      emitCycleUpdate(cycleId, "CANCELLED");
      logger.info({ cycleId }, "Cycle cancelled");
      break;
    }
  }

  // Invalidate cached cycle status after any transition
  await cacheInvalidate("cycle:status:*");

  return prisma.dailyCycle.findUnique({
    where: { id: cycleId },
    include: { dishes: true },
  });
}

export async function runDailyCycleForAllZones(targetStatus: CycleStatus) {
  const zones = await prisma.zone.findMany({ where: { isActive: true } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const zone of zones) {
    try {
      let cycle = await prisma.dailyCycle.findUnique({
        where: { zoneId_date: { zoneId: zone.id, date: today } },
      });

      if (!cycle && targetStatus === CycleStatus.VOTING) {
        // Create new cycle
        cycle = await prisma.dailyCycle.create({
          data: { zoneId: zone.id, date: today, status: "SUGGESTING" },
        });
        logger.info({ zone: zone.name }, "New daily cycle created");
      }

      if (cycle) {
        await triggerCyclePhase(cycle.id, targetStatus);
      }
    } catch (err) {
      logger.error({ zone: zone.name, targetStatus, err }, "Error in cycle phase");
    }
  }
}

function getTimingForActivityLevel(activityLevel?: string | null) {
  const level = (activityLevel ?? "MEDIUM") as keyof typeof ACTIVITY_LEVELS;
  return ACTIVITY_LEVELS[level] ?? ACTIVITY_LEVELS.MEDIUM;
}

export function initCronJobs() {
  // 6:00 AM — Create cycle + AI generates dishes → VOTING
  cron.schedule("0 6 * * *", async () => {
    const queued = await enqueueCyclePhase({ targetStatus: CycleStatus.VOTING });
    if (!queued) runDailyCycleForAllZones(CycleStatus.VOTING);
  });

  // 12:00 PM — Close voting → BIDDING
  cron.schedule("0 12 * * *", async () => {
    const queued = await enqueueCyclePhase({ targetStatus: CycleStatus.BIDDING });
    if (!queued) runDailyCycleForAllZones(CycleStatus.BIDDING);
  });

  // 2:00 PM — Close bidding → SOURCING
  cron.schedule("0 14 * * *", async () => {
    const queued = await enqueueCyclePhase({ targetStatus: CycleStatus.SOURCING });
    if (!queued) runDailyCycleForAllZones(CycleStatus.SOURCING);
  });

  // 5:00 PM — Open orders → ORDERING
  cron.schedule("0 17 * * *", async () => {
    const queued = await enqueueCyclePhase({ targetStatus: CycleStatus.ORDERING });
    if (!queued) runDailyCycleForAllZones(CycleStatus.ORDERING);
  });

  // 9:30 PM — Close cycle → COMPLETED
  cron.schedule("30 21 * * *", async () => {
    const queued = await enqueueCyclePhase({ targetStatus: CycleStatus.COMPLETED });
    if (!queued) runDailyCycleForAllZones(CycleStatus.COMPLETED);
  });

  logger.info("Daily cycle cron jobs initialized");
}
