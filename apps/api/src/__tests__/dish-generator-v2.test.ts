import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestSupplierWithInventory } from "./helpers/fixtures";
import { computeDishOptimizationScores } from "../services/optimization";

describe("Dish Generator v2 — Optimization Scoring Integration", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("stores optimization scores on dishes after computation", async () => {
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
    const dishes = await createTestDishes(cycle.id, 3);

    const results = await computeDishOptimizationScores(cycle.id, zone.id);

    expect(results).toHaveLength(3);

    // Verify scores are stored in DB
    for (const result of results) {
      const dish = await prisma.dish.findUnique({ where: { id: result.dishId } });
      expect(dish!.qualityPrediction).toBe(result.qualityPrediction);
      expect(dish!.freshnessScore).toBe(result.freshnessScore);
      expect(dish!.varietyScore).toBe(result.varietyScore);
      expect(dish!.wasteRisk).toBe(result.wasteRisk);
      expect(dish!.optimizationScore).toBe(result.optimizationScore);
    }
  });

  it("returns results sorted by optimization score", async () => {
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
    await createTestDishes(cycle.id, 4);

    const results = await computeDishOptimizationScores(cycle.id, zone.id);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].optimizationScore).toBeGreaterThanOrEqual(results[i].optimizationScore);
    }
  });

  describe("equipment filtering", () => {
    it("stores equipmentRequired on dishes", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);

      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Tandoori Chicken",
          description: "Classic tandoori dish",
          cuisine: "Indian",
          estimatedCost: 14,
          equipmentRequired: ["tandoor", "oven"],
        },
      });

      const fetched = await prisma.dish.findUnique({ where: { id: dish.id } });
      expect(fetched!.equipmentRequired).toEqual(["tandoor", "oven"]);
    });

    it("defaults equipmentRequired to empty array", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);

      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Simple Salad",
          description: "Fresh salad",
          cuisine: "American",
          estimatedCost: 8,
        },
      });

      const fetched = await prisma.dish.findUnique({ where: { id: dish.id } });
      expect(fetched!.equipmentRequired).toEqual([]);
    });
  });

  describe("quality prediction", () => {
    it("uses historical quality data for prediction", async () => {
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { cuisineTypes: ["Italian"] },
      });

      // Create historical quality scores
      const { user: consumer } = await createTestUser(UserRole.CONSUMER);
      const prevCycle = await createTestCycle(zone.id, CycleStatus.COMPLETED, {
        date: new Date(Date.now() - 86400000),
      });
      const prevDishes = await createTestDishes(prevCycle.id, 1);
      const order = await prisma.order.create({
        data: {
          userId: consumer.id,
          dailyCycleId: prevCycle.id,
          restaurantId: restaurant.id,
          quantity: 1,
          totalPrice: 15,
          status: "DELIVERED",
          items: { create: { dishId: prevDishes[0].id, quantity: 1, price: 15 } },
        },
      });

      await prisma.qualityScore.create({
        data: {
          orderId: order.id,
          userId: consumer.id,
          restaurantId: restaurant.id,
          dailyCycleId: prevCycle.id,
          taste: 5,
          freshness: 5,
          presentation: 5,
          portion: 5,
          overall: 5.0,
        },
      });

      // Now compute scores for a new cycle
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Italian Pasta",
          description: "test",
          cuisine: "Italian",
          estimatedCost: 12,
        },
      });

      const results = await computeDishOptimizationScores(cycle.id, zone.id);
      expect(results).toHaveLength(1);
      // Should have quality prediction influenced by historical data
      expect(results[0].qualityPrediction).toBeGreaterThan(0);
    });
  });

  describe("freshness scoring", () => {
    it("uses inventory freshness windows for scoring", async () => {
      const zone = await createTestZone();
      const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);

      const supplier = await prisma.supplier.create({
        data: {
          ownerId: supplierOwner.id,
          businessName: "Fresh Farms",
          address: "1 Farm Rd",
          rating: 4.5,
          zoneId: zone.id,
        },
      });

      await prisma.supplierInventory.create({
        data: {
          supplierId: supplier.id,
          ingredientName: "Tomatoes",
          category: "Produce",
          unit: "kg",
          pricePerUnit: 3.0,
          quantityAvailable: 100,
          freshnessWindow: 72,
        },
      });

      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Tomato Soup",
          description: "test",
          cuisine: "American",
          estimatedCost: 8,
          ingredients: {
            create: [{ name: "Tomatoes", quantity: 5, unit: "kg", category: "Produce", substitutes: [] }],
          },
        },
      });

      const results = await computeDishOptimizationScores(cycle.id, zone.id);
      expect(results).toHaveLength(1);
      expect(results[0].freshnessScore).toBeGreaterThan(0);
    });
  });
});
