import { prisma } from "@dotted/db";
import type { ZoneAnalytics, RevenueBreakdown } from "@dotted/shared";

export async function getZoneAnalytics(
  zoneId: string,
  dateRange?: { start: Date; end: Date }
): Promise<ZoneAnalytics> {
  const where: Record<string, unknown> = { dailyCycle: { zoneId } };
  if (dateRange) {
    where.createdAt = { gte: dateRange.start, lte: dateRange.end };
  }

  const [orderAgg, qualityAgg, cycles] = await Promise.all([
    prisma.order.aggregate({
      where: where as any,
      _sum: { totalPrice: true },
      _count: { id: true },
    }),
    prisma.qualityScore.aggregate({
      where: { restaurant: { zoneId } },
      _avg: { overall: true },
    }),
    prisma.dailyCycle.count({
      where: {
        zoneId,
        status: { in: ["VOTING", "BIDDING", "SOURCING", "ORDERING"] },
      },
    }),
  ]);

  // Waste: cycles with COMPLETED status that had sourced items but low order count
  const completedCycles = await prisma.dailyCycle.findMany({
    where: { zoneId, status: "COMPLETED" },
    select: { wastePercentage: true },
    orderBy: { date: "desc" },
    take: 30,
  });
  const avgWaste = completedCycles.length > 0
    ? completedCycles.reduce((s, c) => s + (c.wastePercentage ?? 0), 0) / completedCycles.length
    : 0;

  return {
    zoneId,
    totalOrders: orderAgg._count.id,
    totalRevenue: orderAgg._sum.totalPrice ?? 0,
    avgQualityScore: qualityAgg._avg.overall ?? 0,
    wastePercentage: avgWaste,
    activeCycles: cycles,
  };
}

export async function getRevenueBreakdown(
  dateRange?: { start: Date; end: Date }
): Promise<RevenueBreakdown> {
  const orderWhere: Record<string, unknown> = {
    status: { in: ["CONFIRMED", "READY", "PICKED_UP", "DELIVERED"] },
  };
  if (dateRange) {
    orderWhere.createdAt = { gte: dateRange.start, lte: dateRange.end };
  }

  // By zone
  const zones = await prisma.zone.findMany({
    select: { id: true, name: true },
  });

  const byZone = [];
  for (const zone of zones) {
    const agg = await prisma.order.aggregate({
      where: { ...orderWhere, dailyCycle: { zoneId: zone.id } } as any,
      _sum: { totalPrice: true },
    });
    byZone.push({
      zoneId: zone.id,
      zoneName: zone.name,
      revenue: agg._sum.totalPrice ?? 0,
    });
  }

  // By restaurant
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true },
  });

  const byRestaurant = [];
  for (const restaurant of restaurants) {
    const agg = await prisma.order.aggregate({
      where: { ...orderWhere, restaurantId: restaurant.id } as any,
      _sum: { totalPrice: true },
    });
    if ((agg._sum.totalPrice ?? 0) > 0) {
      byRestaurant.push({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        revenue: agg._sum.totalPrice ?? 0,
      });
    }
  }

  const totalAgg = await prisma.order.aggregate({
    where: orderWhere as any,
    _sum: { totalPrice: true },
  });

  // Subscription revenue estimate
  const subscriptionCounts = await prisma.subscription.groupBy({
    by: ["tier"],
    where: { cancelAtPeriodEnd: false },
    _count: { id: true },
  });

  const tierPrices: Record<string, number> = { PLUS: 9.99, PREMIUM: 19.99 };
  const subscriptionRevenue = subscriptionCounts.reduce(
    (sum, s) => sum + (tierPrices[s.tier] ?? 0) * s._count.id,
    0
  );

  return {
    totalRevenue: totalAgg._sum.totalPrice ?? 0,
    byZone: byZone.filter((z) => z.revenue > 0),
    byRestaurant: byRestaurant.sort((a, b) => b.revenue - a.revenue),
    subscriptionRevenue,
  };
}

export async function getDemandForecast(zoneId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const cycles = await prisma.dailyCycle.findMany({
    where: { zoneId, status: "COMPLETED", date: { gte: since } },
    include: { _count: { select: { orders: true } } },
    orderBy: { date: "asc" },
  });

  // 30-day moving average
  const orderCounts = cycles.map((c) => c._count.orders);
  const movingAvg = orderCounts.length > 0
    ? orderCounts.reduce((s, c) => s + c, 0) / orderCounts.length
    : 0;

  // Day-of-week seasonality
  const dayOfWeekMap: Record<number, { sum: number; count: number }> = {};
  for (const cycle of cycles) {
    const dow = cycle.date.getDay();
    if (!dayOfWeekMap[dow]) dayOfWeekMap[dow] = { sum: 0, count: 0 };
    dayOfWeekMap[dow].sum += cycle._count.orders;
    dayOfWeekMap[dow].count++;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const seasonality = dayNames.map((name, i) => ({
    day: name,
    avgOrders: dayOfWeekMap[i] ? dayOfWeekMap[i].sum / dayOfWeekMap[i].count : 0,
  }));

  // Forecast next 7 days
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dow = date.getDay();
    const dayFactor = dayOfWeekMap[dow]
      ? (dayOfWeekMap[dow].sum / dayOfWeekMap[dow].count) / Math.max(movingAvg, 1)
      : 1;
    forecast.push({
      date: date.toISOString().split("T")[0],
      predictedOrders: Math.round(movingAvg * dayFactor),
    });
  }

  return { movingAvg, seasonality, forecast };
}

export async function getWasteReport(
  zoneId: string,
  dateRange?: { start: Date; end: Date }
) {
  const where: Record<string, unknown> = { zoneId, status: "COMPLETED" };
  if (dateRange) {
    where.date = { gte: dateRange.start, lte: dateRange.end };
  }

  const cycles = await prisma.dailyCycle.findMany({
    where: where as any,
    include: {
      _count: { select: { orders: true } },
      purchaseOrders: {
        select: { totalCost: true },
      },
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  return cycles.map((cycle) => {
    const sourcedCost = cycle.purchaseOrders.reduce((s, po) => s + po.totalCost, 0);
    return {
      cycleId: cycle.id,
      date: cycle.date,
      totalOrders: cycle._count.orders,
      totalRevenue: cycle.totalRevenue ?? 0,
      sourcedCost,
      wastePercentage: cycle.wastePercentage ?? 0,
    };
  });
}
