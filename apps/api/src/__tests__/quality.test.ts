import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser, getAuthHeader } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestQualityScore } from "./helpers/fixtures";
import { createApp } from "./helpers/app";
import { submitQualityScore, getRestaurantQuality, getQualityTrend, checkQualityAlerts, getQualityLeaderboard } from "../services/quality";

const app = createApp();

describe("Quality Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("submitQualityScore", () => {
    it("creates a quality score for a delivered order", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          dailyCycleId: cycle.id,
          restaurantId: restaurant.id,
          quantity: 1,
          totalPrice: 15,
          status: "DELIVERED",
          items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } },
        },
      });

      const score = await submitQualityScore({
        orderId: order.id,
        userId: user.id,
        taste: 5,
        freshness: 4,
        presentation: 4,
        portion: 3,
        comment: "Great food!",
      });

      expect(score.overall).toBe(4);
      expect(score.taste).toBe(5);
      expect(score.comment).toBe("Great food!");
    });

    it("rejects scoring for non-delivered orders", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.ORDERING);
      const dishes = await createTestDishes(cycle.id, 1);

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          dailyCycleId: cycle.id,
          restaurantId: restaurant.id,
          quantity: 1,
          totalPrice: 15,
          status: "CONFIRMED",
          items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } },
        },
      });

      await expect(
        submitQualityScore({ orderId: order.id, userId: user.id, taste: 5, freshness: 4, presentation: 4, portion: 3 })
      ).rejects.toThrow("must be delivered");
    });

    it("rejects duplicate scores", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          dailyCycleId: cycle.id,
          restaurantId: restaurant.id,
          quantity: 1,
          totalPrice: 15,
          status: "DELIVERED",
          items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } },
        },
      });

      await submitQualityScore({ orderId: order.id, userId: user.id, taste: 5, freshness: 4, presentation: 4, portion: 3 });
      await expect(
        submitQualityScore({ orderId: order.id, userId: user.id, taste: 3, freshness: 3, presentation: 3, portion: 3 })
      ).rejects.toThrow("already submitted");
    });
  });

  describe("getRestaurantQuality", () => {
    it("aggregates quality scores across dimensions", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const { user: user2 } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);

      const order1 = await prisma.order.create({
        data: { userId: user.id, dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });
      const order2 = await prisma.order.create({
        data: { userId: user2.id, dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });

      await createTestQualityScore(order1.id, user.id, restaurant.id, cycle.id, { taste: 5, freshness: 4, presentation: 4, portion: 4 });
      await createTestQualityScore(order2.id, user2.id, restaurant.id, cycle.id, { taste: 3, freshness: 3, presentation: 3, portion: 3 });

      const quality = await getRestaurantQuality(restaurant.id);
      expect(quality.totalScores).toBe(2);
      expect(quality.avgTaste).toBe(4);
      expect(quality.avgOverall).toBe(3.625);
    });
  });

  describe("getQualityTrend", () => {
    it("returns daily averages", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);

      const order = await prisma.order.create({
        data: { userId: user.id, dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });
      await createTestQualityScore(order.id, user.id, restaurant.id, cycle.id);

      const trend = await getQualityTrend(restaurant.id, 7);
      expect(trend.length).toBeGreaterThanOrEqual(1);
      expect(trend[0].avgScore).toBeGreaterThan(0);
    });
  });

  describe("checkQualityAlerts", () => {
    it("returns no alert with insufficient data", async () => {
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);

      const result = await checkQualityAlerts(restaurant.id);
      expect(result.alert).toBe(false);
    });
  });

  describe("getQualityLeaderboard", () => {
    it("ranks restaurants by quality score", async () => {
      const zone = await createTestZone();
      const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant1 = await createTestRestaurant(owner1.id, zone.id, { name: "Good Place" });
      const restaurant2 = await createTestRestaurant(owner2.id, zone.id, { name: "Better Place" });
      const { user: consumer } = await createTestUser(UserRole.CONSUMER);
      const { user: consumer2 } = await createTestUser(UserRole.CONSUMER);
      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);

      const order1 = await prisma.order.create({
        data: { userId: consumer.id, dailyCycleId: cycle.id, restaurantId: restaurant1.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });
      const order2 = await prisma.order.create({
        data: { userId: consumer2.id, dailyCycleId: cycle.id, restaurantId: restaurant2.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });

      await createTestQualityScore(order1.id, consumer.id, restaurant1.id, cycle.id, { taste: 3, freshness: 3, presentation: 3, portion: 3 });
      await createTestQualityScore(order2.id, consumer2.id, restaurant2.id, cycle.id, { taste: 5, freshness: 5, presentation: 5, portion: 5 });

      const leaderboard = await getQualityLeaderboard(zone.id);
      expect(leaderboard[0].restaurantName).toBe("Better Place");
      expect(leaderboard[1].restaurantName).toBe("Good Place");
    });
  });
});

describe("Quality Routes", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("POST /api/quality/scores — creates quality score", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);
    const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
    const dishes = await createTestDishes(cycle.id, 1);

    const order = await prisma.order.create({
      data: { userId: user.id, dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
    });

    const res = await request(app)
      .post("/api/quality/scores")
      .set(getAuthHeader(token))
      .send({ orderId: order.id, taste: 4, freshness: 4, presentation: 5, portion: 3 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overall).toBe(4);
  });

  it("GET /api/quality/restaurant/:id — returns quality aggregation", async () => {
    const zone = await createTestZone();
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);

    const res = await request(app).get(`/api/quality/restaurant/${restaurant.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalScores).toBe(0);
  });

  it("GET /api/quality/leaderboard — returns zone leaderboard", async () => {
    const zone = await createTestZone();

    const res = await request(app).get(`/api/quality/leaderboard?zoneId=${zone.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
