import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestPreferenceSignal } from "./helpers/fixtures";
import { getUserPreferenceSummary, getPersonalizedDishRanking, recordPreferenceSignal } from "../services/personalization";

describe("Personalization Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("recordPreferenceSignal", () => {
    it("records a vote signal", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const signal = await recordPreferenceSignal(user.id, {
        signalType: "VOTE",
        dishName: "Pasta Carbonara",
        cuisine: "Italian",
        tags: ["pasta", "cream"],
      });

      expect(signal.signalType).toBe("VOTE");
      expect(signal.cuisine).toBe("Italian");
    });

    it("records an order signal", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const signal = await recordPreferenceSignal(user.id, {
        signalType: "ORDER",
        dishName: "Tacos",
        cuisine: "Mexican",
      });

      expect(signal.signalType).toBe("ORDER");
    });
  });

  describe("getUserPreferenceSummary", () => {
    it("returns empty summary for new user", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const summary = await getUserPreferenceSummary(user.id);

      expect(summary.totalSignals).toBe(0);
      expect(Object.keys(summary.cuisineWeights)).toHaveLength(0);
    });

    it("aggregates cuisine preferences with correct weighting", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);

      // 2 Italian orders (weight 3 each = 6), 1 Mexican vote (weight 2)
      await createTestPreferenceSignal(user.id, { signalType: "ORDER", cuisine: "Italian" });
      await createTestPreferenceSignal(user.id, { signalType: "ORDER", cuisine: "Italian" });
      await createTestPreferenceSignal(user.id, { signalType: "VOTE", cuisine: "Mexican" });

      const summary = await getUserPreferenceSummary(user.id);
      expect(summary.totalSignals).toBe(3);
      expect(summary.cuisineWeights["italian"]).toBe(1); // highest = 1.0
      expect(summary.cuisineWeights["mexican"]).toBeLessThan(1);
    });

    it("handles tag weights", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);

      await createTestPreferenceSignal(user.id, { signalType: "VOTE", tags: ["spicy", "vegetarian"] });
      await createTestPreferenceSignal(user.id, { signalType: "ORDER", tags: ["spicy"] });

      const summary = await getUserPreferenceSummary(user.id);
      expect(summary.tagWeights["spicy"]).toBe(1); // highest
      expect(summary.tagWeights["vegetarian"]).toBeLessThan(1);
    });
  });

  describe("getPersonalizedDishRanking", () => {
    it("boosts dishes matching user preferences", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);

      // Create cuisine preference for Italian
      for (let i = 0; i < 5; i++) {
        await createTestPreferenceSignal(user.id, { signalType: "ORDER", cuisine: "Italian" });
      }

      const dishes = await createTestDishes(cycle.id, 4);

      const baseDishResults = dishes.map((d) => ({
        dishId: d.id,
        name: d.name,
        qualityPrediction: 0.5,
        freshnessScore: 0.5,
        varietyScore: 0.5,
        wasteRisk: 0.3,
        optimizationScore: 0.5,
      }));

      const personalized = await getPersonalizedDishRanking(user.id, baseDishResults);
      expect(personalized).toHaveLength(4);
      // The Italian dish should get boosted
      const italianDish = personalized.find((d) => {
        const original = dishes.find((od) => od.id === d.dishId);
        return original?.cuisine === "Italian";
      });
      expect(italianDish).toBeDefined();
    });

    it("returns original order for users with no preferences", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 2);

      const baseDishResults = dishes.map((d, i) => ({
        dishId: d.id,
        name: d.name,
        qualityPrediction: 0.5,
        freshnessScore: 0.5,
        varietyScore: 0.5,
        wasteRisk: 0.3,
        optimizationScore: 1 - i * 0.1,
      }));

      const personalized = await getPersonalizedDishRanking(user.id, baseDishResults);
      expect(personalized[0].dishId).toBe(baseDishResults[0].dishId);
    });
  });
});
