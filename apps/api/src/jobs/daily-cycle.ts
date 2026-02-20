import cron from "node-cron";
import { prisma, CycleStatus } from "@dotted/db";
import { generateDishSuggestions } from "../ai/dish-generator";
import { tallyVotes } from "../services/voting";
import { scoreBidsAndSelectWinner } from "../services/bidding";
import { optimizeSourcing } from "../ai/supplier-matcher";
import { getIO } from "../socket/handlers";
import { cacheInvalidate } from "../lib/redis";
import { notify } from "../services/notifications";

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
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "VOTING" } });
      emitCycleUpdate(cycleId, "VOTING");
      console.log(`[Cycle ${cycleId}] Voting opened`);

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
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "BIDDING" } });
      emitCycleUpdate(cycleId, "BIDDING");
      console.log(`[Cycle ${cycleId}] Bidding opened. Winning dish: ${voteResult.winningDishName}`);
      break;
    }

    case CycleStatus.SOURCING: {
      // Score bids, select winner, start sourcing
      const bidResult = await scoreBidsAndSelectWinner(cycleId);
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "SOURCING" } });
      emitCycleUpdate(cycleId, "SOURCING");
      console.log(`[Cycle ${cycleId}] Sourcing started. Winning restaurant: ${bidResult.restaurantName}`);

      // Generate purchase orders
      await optimizeSourcing(cycleId);
      console.log(`[Cycle ${cycleId}] Purchase orders created`);
      break;
    }

    case CycleStatus.ORDERING: {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "ORDERING" } });
      emitCycleUpdate(cycleId, "ORDERING");
      console.log(`[Cycle ${cycleId}] Orders open`);

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
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "COMPLETED" } });
      emitCycleUpdate(cycleId, "COMPLETED");
      console.log(`[Cycle ${cycleId}] Cycle completed`);
      break;
    }

    case CycleStatus.CANCELLED: {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "CANCELLED" } });
      emitCycleUpdate(cycleId, "CANCELLED");
      console.log(`[Cycle ${cycleId}] Cycle cancelled`);
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
        console.log(`[Zone ${zone.name}] New daily cycle created`);
      }

      if (cycle) {
        await triggerCyclePhase(cycle.id, targetStatus);
      }
    } catch (err) {
      console.error(`[Zone ${zone.name}] Error in cycle phase ${targetStatus}:`, err);
    }
  }
}

export function initCronJobs() {
  // 6:00 AM — Create cycle + AI generates dishes → VOTING
  cron.schedule("0 6 * * *", () => runDailyCycleForAllZones(CycleStatus.VOTING));

  // 12:00 PM — Close voting → BIDDING
  cron.schedule("0 12 * * *", () => runDailyCycleForAllZones(CycleStatus.BIDDING));

  // 2:00 PM — Close bidding → SOURCING
  cron.schedule("0 14 * * *", () => runDailyCycleForAllZones(CycleStatus.SOURCING));

  // 5:00 PM — Open orders → ORDERING
  cron.schedule("0 17 * * *", () => runDailyCycleForAllZones(CycleStatus.ORDERING));

  // 9:30 PM — Close cycle → COMPLETED
  cron.schedule("30 21 * * *", () => runDailyCycleForAllZones(CycleStatus.COMPLETED));

  console.log("Daily cycle cron jobs initialized");
}
