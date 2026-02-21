import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestBid } from "./helpers/fixtures";
import { scoreBidsAndSelectWinner, getCommissionRate } from "../services/bidding";

describe("Enhanced Bidding Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("equipment filtering", () => {
    it("prefers restaurants with required equipment", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.BIDDING);
      const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: consumer } = await createTestUser(UserRole.CONSUMER);
      await prisma.zoneMembership.create({ data: { userId: consumer.id, zoneId: zone.id } });

      // Restaurant with required equipment
      const restaurant1 = await createTestRestaurant(owner1.id, zone.id, {
        name: "Equipped Kitchen",
        rating: 4.0,
        equipmentTags: ["grill", "oven"],
      });
      // Restaurant without
      const restaurant2 = await createTestRestaurant(owner2.id, zone.id, {
        name: "Basic Kitchen",
        rating: 4.5,
      });

      // Create dish requiring grill
      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Grilled Steak",
          description: "test",
          cuisine: "American",
          estimatedCost: 15,
          equipmentRequired: ["grill"],
        },
      });
      await prisma.dailyCycle.update({
        where: { id: cycle.id },
        data: { winningDishId: dish.id },
      });

      await createTestBid(restaurant1.id, cycle.id, dish.id, { pricePerPlate: 16, prepTime: 30 });
      await createTestBid(restaurant2.id, cycle.id, dish.id, { pricePerPlate: 14, prepTime: 25 });

      const result = await scoreBidsAndSelectWinner(cycle.id);
      expect(result.restaurantName).toBe("Equipped Kitchen");
    });
  });

  describe("partner tier priority", () => {
    it("gives bonus to higher-tier partners", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.BIDDING);
      const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: consumer } = await createTestUser(UserRole.CONSUMER);
      await prisma.zoneMembership.create({ data: { userId: consumer.id, zoneId: zone.id } });

      const restaurant1 = await createTestRestaurant(owner1.id, zone.id, {
        name: "Platinum Partner",
        rating: 4.0,
        partnerTier: "PLATINUM",
      });
      const restaurant2 = await createTestRestaurant(owner2.id, zone.id, {
        name: "Standard Partner",
        rating: 4.0,
        partnerTier: "STANDARD",
      });

      const dishes = await createTestDishes(cycle.id, 1);
      await prisma.dailyCycle.update({
        where: { id: cycle.id },
        data: { winningDishId: dishes[0].id },
      });

      // Same price and similar attributes — tier should be tiebreaker
      await createTestBid(restaurant1.id, cycle.id, dishes[0].id, { pricePerPlate: 15, prepTime: 30 });
      await createTestBid(restaurant2.id, cycle.id, dishes[0].id, { pricePerPlate: 15, prepTime: 30 });

      const result = await scoreBidsAndSelectWinner(cycle.id);
      expect(result.restaurantName).toBe("Platinum Partner");
    });
  });

  describe("concurrent order cap", () => {
    it("filters out restaurants at capacity", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.BIDDING);
      const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: consumer } = await createTestUser(UserRole.CONSUMER);
      await prisma.zoneMembership.create({ data: { userId: consumer.id, zoneId: zone.id } });

      // Restaurant at capacity (maxConcurrentOrders = 1, 1 active order)
      const restaurant1 = await createTestRestaurant(owner1.id, zone.id, {
        name: "Busy Kitchen",
        rating: 5.0,
        maxConcurrentOrders: 1,
      });
      const restaurant2 = await createTestRestaurant(owner2.id, zone.id, {
        name: "Available Kitchen",
        rating: 3.5,
      });

      const dishes = await createTestDishes(cycle.id, 1);
      await prisma.dailyCycle.update({
        where: { id: cycle.id },
        data: { winningDishId: dishes[0].id },
      });

      // Create existing order for restaurant1
      await prisma.order.create({
        data: {
          userId: consumer.id,
          dailyCycleId: cycle.id,
          restaurantId: restaurant1.id,
          quantity: 1,
          totalPrice: 15,
          status: "CONFIRMED",
          items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } },
        },
      });

      await createTestBid(restaurant1.id, cycle.id, dishes[0].id, { pricePerPlate: 12 });
      await createTestBid(restaurant2.id, cycle.id, dishes[0].id, { pricePerPlate: 16 });

      const result = await scoreBidsAndSelectWinner(cycle.id);
      expect(result.restaurantName).toBe("Available Kitchen");
    });
  });

  describe("getCommissionRate", () => {
    it("returns restaurant-specific override", () => {
      const rate = getCommissionRate({ commissionRate: 0.05, partnerTier: "GOLD" });
      expect(rate).toBe(0.05);
    });

    it("returns partner tier rate", () => {
      const rate = getCommissionRate({ partnerTier: "GOLD" });
      expect(rate).toBe(0.06);
    });

    it("returns standard rate by default", () => {
      const rate = getCommissionRate({});
      expect(rate).toBe(0.10);
    });
  });
});
