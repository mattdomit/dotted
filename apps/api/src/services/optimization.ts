import { prisma } from "@dotted/db";
import { DEFAULT_OPTIMIZATION_WEIGHTS } from "@dotted/shared";
import type { OptimizationWeights, DishOptimizationResult } from "@dotted/shared";

export function getZoneWeights(zone: {
  optWeightQuality?: number | null;
  optWeightFreshness?: number | null;
  optWeightVariety?: number | null;
  optWeightCost?: number | null;
  optWeightWaste?: number | null;
}): OptimizationWeights {
  if (
    zone.optWeightQuality != null &&
    zone.optWeightFreshness != null &&
    zone.optWeightVariety != null &&
    zone.optWeightCost != null &&
    zone.optWeightWaste != null
  ) {
    return {
      quality: zone.optWeightQuality,
      freshness: zone.optWeightFreshness,
      variety: zone.optWeightVariety,
      cost: zone.optWeightCost,
      waste: zone.optWeightWaste,
    };
  }
  return { ...DEFAULT_OPTIMIZATION_WEIGHTS };
}

export async function computeDishOptimizationScores(
  cycleId: string,
  zoneId: string
): Promise<DishOptimizationResult[]> {
  const dishes = await prisma.dish.findMany({
    where: { dailyCycleId: cycleId },
    include: { ingredients: true },
  });

  if (dishes.length === 0) return [];

  // Get zone for weights
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return [];
  const weights = getZoneWeights(zone);

  // Historical quality data by cuisine
  const qualityScores = await prisma.qualityScore.findMany({
    where: { restaurant: { zoneId } },
    select: { overall: true, restaurant: { select: { cuisineTypes: true } } },
  });

  const cuisineQuality: Record<string, { sum: number; count: number }> = {};
  for (const qs of qualityScores) {
    const types = (qs.restaurant.cuisineTypes as string[]) ?? [];
    for (const cuisine of types) {
      const key = cuisine.toLowerCase();
      if (!cuisineQuality[key]) cuisineQuality[key] = { sum: 0, count: 0 };
      cuisineQuality[key].sum += qs.overall;
      cuisineQuality[key].count++;
    }
  }

  // Freshness data: check ingredient freshness windows from inventory
  const inventory = await prisma.supplierInventory.findMany({
    where: { supplier: { zoneId }, quantityAvailable: { gt: 0 } },
    select: { ingredientName: true, freshnessWindow: true, expiresAt: true },
  });

  const freshnessMap: Record<string, number> = {};
  for (const item of inventory) {
    const key = item.ingredientName.toLowerCase();
    if (item.freshnessWindow != null) {
      freshnessMap[key] = item.freshnessWindow;
    } else if (item.expiresAt) {
      const daysLeft = Math.max(0, (item.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      freshnessMap[key] = Math.min(daysLeft / 7, 1); // normalize: 7+ days = 1.0
    }
  }

  // Past 14 winning dishes for variety calculation (Jaccard distance)
  const pastWinners = await prisma.dish.findMany({
    where: {
      dailyCycle: { zoneId, winningDishId: { not: null } },
    },
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { cuisine: true, name: true },
  });
  const pastCuisineSet = new Set(pastWinners.map((d) => d.cuisine.toLowerCase()));
  const pastNameSet = new Set(pastWinners.map((d) => d.name.toLowerCase()));

  // Order history for waste risk
  const recentCycles = await prisma.dailyCycle.findMany({
    where: { zoneId, status: "COMPLETED" },
    orderBy: { date: "desc" },
    take: 14,
    select: { id: true, _count: { select: { orders: true } } },
  });
  const avgOrderRate = recentCycles.length > 0
    ? recentCycles.reduce((sum, c) => sum + c._count.orders, 0) / recentCycles.length
    : 10;

  const results: DishOptimizationResult[] = [];

  for (const dish of dishes) {
    // Quality prediction: based on historical cuisine quality
    const cuisineKey = dish.cuisine.toLowerCase();
    const cuisineData = cuisineQuality[cuisineKey];
    const qualityPrediction = cuisineData
      ? Math.min(cuisineData.sum / cuisineData.count / 5, 1)
      : 0.6; // default for unknown cuisine

    // Freshness score: average freshness of ingredients
    let freshnessTotal = 0;
    let freshnessCount = 0;
    for (const ing of dish.ingredients) {
      const key = ing.name.toLowerCase();
      if (freshnessMap[key] != null) {
        freshnessTotal += Math.min(freshnessMap[key], 1);
        freshnessCount++;
      }
    }
    const freshnessScore = freshnessCount > 0 ? freshnessTotal / freshnessCount : 0.5;

    // Variety score: Jaccard distance from past winners
    const isNewCuisine = !pastCuisineSet.has(cuisineKey) ? 1 : 0;
    const isNewName = !pastNameSet.has(dish.name.toLowerCase()) ? 1 : 0;
    const varietyScore = (isNewCuisine * 0.6 + isNewName * 0.4);

    // Waste risk: estimated order rate vs capacity (higher = more waste risk)
    const estimatedOrders = avgOrderRate;
    const wasteRisk = dish.estimatedCost > 20
      ? 0.7 // expensive dishes have higher waste risk
      : dish.estimatedCost > 15
        ? 0.4
        : 0.2;

    const optimizationScore = rankDishByObjective(
      { qualityPrediction, freshnessScore, varietyScore, wasteRisk, estimatedCost: dish.estimatedCost },
      weights
    );

    results.push({
      dishId: dish.id,
      name: dish.name,
      qualityPrediction,
      freshnessScore,
      varietyScore,
      wasteRisk,
      optimizationScore,
    });

    // Store scores on dish records
    await prisma.dish.update({
      where: { id: dish.id },
      data: {
        qualityPrediction,
        freshnessScore,
        varietyScore,
        wasteRisk,
        optimizationScore,
      },
    });
  }

  return results.sort((a, b) => b.optimizationScore - a.optimizationScore);
}

function rankDishByObjective(
  scores: {
    qualityPrediction: number;
    freshnessScore: number;
    varietyScore: number;
    wasteRisk: number;
    estimatedCost: number;
  },
  weights: OptimizationWeights
): number {
  // Normalize cost: lower is better, assume max $30
  const costScore = Math.max(0, 1 - scores.estimatedCost / 30);

  return (
    weights.quality * scores.qualityPrediction +
    weights.freshness * scores.freshnessScore +
    weights.variety * scores.varietyScore -
    weights.cost * (1 - costScore) -
    weights.waste * scores.wasteRisk
  );
}

export function rankDishesByObjective(
  dishes: DishOptimizationResult[],
  weights: OptimizationWeights
): DishOptimizationResult[] {
  return [...dishes].sort((a, b) => b.optimizationScore - a.optimizationScore);
}
