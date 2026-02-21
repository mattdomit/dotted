import { prisma } from "@dotted/db";
import type { UserPreferenceSummary, DishOptimizationResult } from "@dotted/shared";

export async function recordPreferenceSignal(
  userId: string,
  signal: {
    signalType: string;
    dishName?: string;
    cuisine?: string;
    tags?: string[];
  }
) {
  return prisma.userPreferenceSignal.create({
    data: {
      userId,
      signalType: signal.signalType,
      dishName: signal.dishName,
      cuisine: signal.cuisine,
      tags: signal.tags ?? [],
    },
  });
}

export async function getUserPreferenceSummary(userId: string): Promise<UserPreferenceSummary> {
  const signals = await prisma.userPreferenceSignal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const cuisineWeights: Record<string, number> = {};
  const tagWeights: Record<string, number> = {};

  const signalWeight: Record<string, number> = {
    ORDER: 3,
    VOTE: 2,
    VIEW: 1,
    SKIP: -1,
  };

  for (const signal of signals) {
    const weight = signalWeight[signal.signalType] ?? 1;

    if (signal.cuisine) {
      const key = signal.cuisine.toLowerCase();
      cuisineWeights[key] = (cuisineWeights[key] ?? 0) + weight;
    }

    const tags = signal.tags as string[];
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        const key = tag.toLowerCase();
        tagWeights[key] = (tagWeights[key] ?? 0) + weight;
      }
    }
  }

  // Normalize weights to 0-1 range
  const maxCuisine = Math.max(...Object.values(cuisineWeights), 1);
  const maxTag = Math.max(...Object.values(tagWeights), 1);

  for (const key of Object.keys(cuisineWeights)) {
    cuisineWeights[key] = cuisineWeights[key] / maxCuisine;
  }
  for (const key of Object.keys(tagWeights)) {
    tagWeights[key] = tagWeights[key] / maxTag;
  }

  return {
    userId,
    cuisineWeights,
    tagWeights,
    totalSignals: signals.length,
  };
}

export async function getPersonalizedDishRanking(
  userId: string,
  dishes: DishOptimizationResult[]
): Promise<DishOptimizationResult[]> {
  const prefs = await getUserPreferenceSummary(userId);

  if (prefs.totalSignals === 0) return dishes;

  // Get dish details for cuisine matching
  const dishDetails = await prisma.dish.findMany({
    where: { id: { in: dishes.map((d) => d.dishId) } },
    select: { id: true, cuisine: true, recipeSpec: true },
  });

  const detailMap = new Map(dishDetails.map((d) => [d.id, d]));

  const scored = dishes.map((dish) => {
    const detail = detailMap.get(dish.dishId);
    let personalBoost = 0;

    if (detail) {
      const cuisineKey = detail.cuisine.toLowerCase();
      personalBoost += (prefs.cuisineWeights[cuisineKey] ?? 0) * 0.3;

      const tags = ((detail.recipeSpec as Record<string, unknown>)?.tags as string[]) ?? [];
      for (const tag of tags) {
        personalBoost += (prefs.tagWeights[tag.toLowerCase()] ?? 0) * 0.1;
      }
    }

    return {
      ...dish,
      optimizationScore: dish.optimizationScore + personalBoost,
    };
  });

  return scored.sort((a, b) => b.optimizationScore - a.optimizationScore);
}
