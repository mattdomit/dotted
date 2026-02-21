import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestSupplierWithInventory } from "./helpers/fixtures";
import { computeDishOptimizationScores, getZoneWeights, rankDishesByObjective } from "../services/optimization";

describe("Optimization Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("getZoneWeights", () => {
    it("returns zone-specific weights when set", () => {
      const weights = getZoneWeights({
        optWeightQuality: 0.4,
        optWeightFreshness: 0.2,
        optWeightVariety: 0.15,
        optWeightCost: 0.15,
        optWeightWaste: 0.1,
      });
      expect(weights.quality).toBe(0.4);
      expect(weights.freshness).toBe(0.2);
    });

    it("returns default weights when zone has no overrides", () => {
      const weights = getZoneWeights({
        optWeightQuality: null,
        optWeightFreshness: null,
        optWeightVariety: null,
        optWeightCost: null,
        optWeightWaste: null,
      });
      expect(weights.quality).toBe(0.3);
      expect(weights.freshness).toBe(0.25);
    });

    it("returns default weights when zone weights are partial", () => {
      const weights = getZoneWeights({
        optWeightQuality: 0.5,
        optWeightFreshness: null,
        optWeightVariety: null,
        optWeightCost: null,
        optWeightWaste: null,
      });
      expect(weights.quality).toBe(0.3); // falls back to defaults
    });
  });

  describe("computeDishOptimizationScores", () => {
    it("computes scores for dishes in a cycle", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 3);

      const results = await computeDishOptimizationScores(cycle.id, zone.id);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.dishId).toBeDefined();
        expect(result.qualityPrediction).toBeGreaterThanOrEqual(0);
        expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
        expect(result.varietyScore).toBeGreaterThanOrEqual(0);
        expect(result.wasteRisk).toBeGreaterThanOrEqual(0);
        expect(result.optimizationScore).toBeDefined();
      }
    });

    it("returns empty array for cycle with no dishes", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);

      const results = await computeDishOptimizationScores(cycle.id, zone.id);
      expect(results).toHaveLength(0);
    });

    it("stores scores on dish records", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      await createTestDishes(cycle.id, 2);

      await computeDishOptimizationScores(cycle.id, zone.id);

      const updatedDishes = await prisma.dish.findMany({
        where: { dailyCycleId: cycle.id },
      });
      for (const dish of updatedDishes) {
        expect(dish.qualityPrediction).not.toBeNull();
        expect(dish.freshnessScore).not.toBeNull();
        expect(dish.optimizationScore).not.toBeNull();
      }
    });

    it("gives higher variety scores to new cuisines", async () => {
      const zone = await createTestZone();

      // Create past cycles with Italian wins
      for (let i = 0; i < 3; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - (i + 1));
        pastDate.setHours(0, 0, 0, 0);
        const pastCycle = await prisma.dailyCycle.create({
          data: { zoneId: zone.id, date: pastDate, status: "COMPLETED" },
        });
        const pastDish = await prisma.dish.create({
          data: {
            dailyCycleId: pastCycle.id,
            name: `Past Italian ${i}`,
            description: "test",
            cuisine: "Italian",
            estimatedCost: 10,
          },
        });
        await prisma.dailyCycle.update({
          where: { id: pastCycle.id },
          data: { winningDishId: pastDish.id },
        });
      }

      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      // Create one Italian and one Thai dish
      await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Another Italian",
          description: "test",
          cuisine: "Italian",
          estimatedCost: 12,
        },
      });
      await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Thai Curry",
          description: "test",
          cuisine: "Thai",
          estimatedCost: 12,
        },
      });

      const results = await computeDishOptimizationScores(cycle.id, zone.id);
      const thai = results.find((r) => r.name === "Thai Curry");
      const italian = results.find((r) => r.name === "Another Italian");

      expect(thai!.varietyScore).toBeGreaterThan(italian!.varietyScore);
    });
  });

  describe("rankDishesByObjective", () => {
    it("sorts dishes by optimization score descending", () => {
      const dishes = [
        { dishId: "1", name: "A", qualityPrediction: 0.5, freshnessScore: 0.5, varietyScore: 0.5, wasteRisk: 0.5, optimizationScore: 0.3 },
        { dishId: "2", name: "B", qualityPrediction: 0.8, freshnessScore: 0.8, varietyScore: 0.8, wasteRisk: 0.2, optimizationScore: 0.8 },
        { dishId: "3", name: "C", qualityPrediction: 0.6, freshnessScore: 0.6, varietyScore: 0.6, wasteRisk: 0.3, optimizationScore: 0.5 },
      ];

      const weights = { quality: 0.3, freshness: 0.25, variety: 0.2, cost: 0.15, waste: 0.1 };
      const ranked = rankDishesByObjective(dishes, weights);

      expect(ranked[0].dishId).toBe("2");
      expect(ranked[1].dishId).toBe("3");
      expect(ranked[2].dishId).toBe("1");
    });
  });
});
