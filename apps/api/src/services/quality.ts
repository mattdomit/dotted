import { prisma } from "@dotted/db";
import type { QualityAggregation } from "@dotted/shared";
import { logger } from "../lib/logger";

interface SubmitQualityScoreInput {
  orderId: string;
  userId: string;
  taste: number;
  freshness: number;
  presentation: number;
  portion: number;
  comment?: string;
}

export async function submitQualityScore(input: SubmitQualityScoreInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { status: true, restaurantId: true, dailyCycleId: true, userId: true },
  });

  if (!order) throw new Error("Order not found");
  if (order.status !== "DELIVERED") throw new Error("Order must be delivered before scoring");
  if (order.userId !== input.userId) throw new Error("You can only score your own orders");

  const existing = await prisma.qualityScore.findUnique({
    where: { orderId: input.orderId },
  });
  if (existing) throw new Error("Quality score already submitted for this order");

  const overall = (input.taste + input.freshness + input.presentation + input.portion) / 4;

  const score = await prisma.qualityScore.create({
    data: {
      orderId: input.orderId,
      userId: input.userId,
      restaurantId: order.restaurantId,
      dailyCycleId: order.dailyCycleId,
      taste: input.taste,
      freshness: input.freshness,
      presentation: input.presentation,
      portion: input.portion,
      overall,
      comment: input.comment,
    },
  });

  // Check if restaurant avg drops below 3.0
  const agg = await prisma.qualityScore.aggregate({
    where: { restaurantId: order.restaurantId },
    _avg: { overall: true },
  });

  if (agg._avg.overall != null && agg._avg.overall < 3.0) {
    logger.warn({ restaurantId: order.restaurantId, avg: agg._avg.overall }, "Restaurant quality alert: avg below 3.0");
  }

  return score;
}

export async function getRestaurantQuality(restaurantId: string): Promise<QualityAggregation> {
  const agg = await prisma.qualityScore.aggregate({
    where: { restaurantId },
    _avg: {
      taste: true,
      freshness: true,
      presentation: true,
      portion: true,
      overall: true,
    },
    _count: { id: true },
  });

  return {
    restaurantId,
    avgTaste: agg._avg.taste ?? 0,
    avgFreshness: agg._avg.freshness ?? 0,
    avgPresentation: agg._avg.presentation ?? 0,
    avgPortion: agg._avg.portion ?? 0,
    avgOverall: agg._avg.overall ?? 0,
    totalScores: agg._count.id,
  };
}

export async function getQualityTrend(restaurantId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const scores = await prisma.qualityScore.findMany({
    where: { restaurantId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { overall: true, createdAt: true },
  });

  // Group by day
  const dailyMap = new Map<string, { sum: number; count: number }>();
  for (const s of scores) {
    const day = s.createdAt.toISOString().split("T")[0];
    const entry = dailyMap.get(day) ?? { sum: 0, count: 0 };
    entry.sum += s.overall;
    entry.count++;
    dailyMap.set(day, entry);
  }

  return Array.from(dailyMap.entries()).map(([date, { sum, count }]) => ({
    date,
    avgScore: sum / count,
    count,
  }));
}

export async function checkQualityAlerts(restaurantId: string) {
  // Rolling 5-score drop detection
  const recent = await prisma.qualityScore.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { overall: true, createdAt: true },
  });

  if (recent.length < 5) return { alert: false, message: "Insufficient data" };

  const lastFive = recent.slice(0, 5);
  const prevFive = recent.slice(5, 10);

  const lastAvg = lastFive.reduce((s, r) => s + r.overall, 0) / lastFive.length;
  const prevAvg = prevFive.length > 0
    ? prevFive.reduce((s, r) => s + r.overall, 0) / prevFive.length
    : lastAvg;

  const drop = prevAvg - lastAvg;
  const alert = drop > 0.5 || lastAvg < 3.0;

  return {
    alert,
    lastAvg,
    prevAvg,
    drop,
    message: alert
      ? `Quality declining: last 5 avg ${lastAvg.toFixed(2)} (dropped ${drop.toFixed(2)})`
      : "Quality stable",
  };
}

export async function getQualityLeaderboard(zoneId: string) {
  const restaurants = await prisma.restaurant.findMany({
    where: { zoneId },
    select: { id: true, name: true },
  });

  const leaderboard = [];
  for (const restaurant of restaurants) {
    const agg = await prisma.qualityScore.aggregate({
      where: { restaurantId: restaurant.id },
      _avg: { overall: true },
      _count: { id: true },
    });

    if (agg._count.id > 0) {
      leaderboard.push({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        avgScore: agg._avg.overall ?? 0,
        totalScores: agg._count.id,
      });
    }
  }

  return leaderboard.sort((a, b) => b.avgScore - a.avgScore);
}
