import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser, getAuthHeader } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant } from "./helpers/fixtures";
import { createApp } from "./helpers/app";
import { getZoneAnalytics, getRevenueBreakdown, getDemandForecast } from "../services/analytics";

const app = createApp();

describe("Analytics Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("getZoneAnalytics", () => {
    it("returns zone analytics", async () => {
      const zone = await createTestZone();
      const analytics = await getZoneAnalytics(zone.id);

      expect(analytics.zoneId).toBe(zone.id);
      expect(analytics.totalOrders).toBe(0);
      expect(analytics.totalRevenue).toBe(0);
    });

    it("includes order data", async () => {
      const zone = await createTestZone();
      const { user } = await createTestUser(UserRole.CONSUMER);
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.ORDERING);
      const dishes = await createTestDishes(cycle.id, 1);

      await prisma.order.create({
        data: {
          userId: user.id,
          dailyCycleId: cycle.id,
          restaurantId: restaurant.id,
          quantity: 2,
          totalPrice: 30,
          status: "DELIVERED",
          items: { create: { dishId: dishes[0].id, quantity: 2, price: 15 } },
        },
      });

      const analytics = await getZoneAnalytics(zone.id);
      expect(analytics.totalOrders).toBe(1);
      expect(analytics.totalRevenue).toBe(30);
    });
  });

  describe("getRevenueBreakdown", () => {
    it("returns revenue breakdown", async () => {
      const breakdown = await getRevenueBreakdown();
      expect(breakdown.totalRevenue).toBe(0);
      expect(breakdown.byZone).toEqual([]);
      expect(breakdown.subscriptionRevenue).toBe(0);
    });
  });

  describe("getDemandForecast", () => {
    it("returns forecast data", async () => {
      const zone = await createTestZone();
      const forecast = await getDemandForecast(zone.id, 30);

      expect(forecast.movingAvg).toBe(0);
      expect(forecast.forecast).toHaveLength(7);
      expect(forecast.seasonality).toHaveLength(7);
    });
  });
});

describe("Analytics Routes", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("GET /api/analytics/zone/:id — returns zone analytics", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();

    const res = await request(app)
      .get(`/api/analytics/zone/${zone.id}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.zoneId).toBe(zone.id);
  });

  it("GET /api/analytics/revenue — admin only", async () => {
    const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);
    const { token: adminToken } = await createTestUser(UserRole.ADMIN);

    const res1 = await request(app)
      .get("/api/analytics/revenue")
      .set(getAuthHeader(consumerToken));
    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .get("/api/analytics/revenue")
      .set(getAuthHeader(adminToken));
    expect(res2.status).toBe(200);
  });

  it("GET /api/analytics/forecast/:id — returns demand forecast", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);
    const zone = await createTestZone();

    const res = await request(app)
      .get(`/api/analytics/forecast/${zone.id}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.forecast).toHaveLength(7);
  });

  it("GET /api/analytics/waste — admin only, requires zoneId", async () => {
    const { token: adminToken } = await createTestUser(UserRole.ADMIN);

    const res1 = await request(app)
      .get("/api/analytics/waste")
      .set(getAuthHeader(adminToken));
    expect(res1.status).toBe(400);

    const zone = await createTestZone();
    const res2 = await request(app)
      .get(`/api/analytics/waste?zoneId=${zone.id}`)
      .set(getAuthHeader(adminToken));
    expect(res2.status).toBe(200);
  });
});
