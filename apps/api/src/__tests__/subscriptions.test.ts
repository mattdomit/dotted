import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser, getAuthHeader } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestSubscription } from "./helpers/fixtures";
import { createApp } from "./helpers/app";
import { createSubscription, cancelSubscription, getSubscriptionLimits, checkFeatureAccess } from "../services/subscription";

const app = createApp();

describe("Subscription Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("createSubscription", () => {
    it("creates a new subscription", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const sub = await createSubscription(user.id, "PLUS");

      expect(sub.tier).toBe("PLUS");
      expect(sub.userId).toBe(user.id);
      expect(sub.cancelAtPeriodEnd).toBe(false);

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.subscriptionTier).toBe("PLUS");
    });

    it("rejects if active subscription exists", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await createSubscription(user.id, "PLUS");

      await expect(createSubscription(user.id, "PREMIUM")).rejects.toThrow("Active subscription already exists");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels subscription at period end", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await createSubscription(user.id, "PLUS");
      const result = await cancelSubscription(user.id);

      expect(result.message).toContain("cancelled");

      const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
      expect(sub!.cancelAtPeriodEnd).toBe(true);
    });

    it("rejects if no subscription", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await expect(cancelSubscription(user.id)).rejects.toThrow("No subscription found");
    });
  });

  describe("getSubscriptionLimits", () => {
    it("returns FREE tier limits by default", () => {
      const limits = getSubscriptionLimits("FREE");
      expect(limits.votesPerCycle).toBe(1);
      expect(limits.maxOrdersPerDay).toBe(2);
    });

    it("returns PLUS tier limits", () => {
      const limits = getSubscriptionLimits("PLUS");
      expect(limits.votesPerCycle).toBe(3);
      expect(limits.maxOrdersPerDay).toBe(5);
    });

    it("returns PREMIUM tier limits", () => {
      const limits = getSubscriptionLimits("PREMIUM");
      expect(limits.votesPerCycle).toBe(5);
      expect(limits.maxOrdersPerDay).toBe(10);
    });
  });

  describe("checkFeatureAccess", () => {
    it("denies premium features for free users", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const access = await checkFeatureAccess(user.id, "personalized_ranking");
      expect(access).toBe(false);
    });

    it("grants premium features for premium users", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await createTestSubscription(user.id, "PREMIUM");
      const access = await checkFeatureAccess(user.id, "personalized_ranking");
      expect(access).toBe(true);
    });

    it("grants basic features for all users", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const access = await checkFeatureAccess(user.id, "basic_voting");
      expect(access).toBe(true);
    });
  });
});

describe("Subscription Routes", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("POST /api/subscriptions — creates subscription", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);

    const res = await request(app)
      .post("/api/subscriptions")
      .set(getAuthHeader(token))
      .send({ tier: "PLUS" });

    expect(res.status).toBe(201);
    expect(res.body.data.tier).toBe("PLUS");
  });

  it("GET /api/subscriptions/me — returns current status", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER);

    const res = await request(app)
      .get("/api/subscriptions/me")
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe("FREE");
  });

  it("DELETE /api/subscriptions — cancels subscription", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER);
    await createTestSubscription(user.id, "PLUS");

    const res = await request(app)
      .delete("/api/subscriptions")
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("cancelled");
  });

  describe("tier limits on votes", () => {
    it("enforces vote limit for FREE users", async () => {
      const { user, token } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      await prisma.zoneMembership.create({ data: { userId: user.id, zoneId: zone.id } });
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 3);

      // First vote should succeed
      const res1 = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(token))
        .send({ dishId: dishes[0].id, dailyCycleId: cycle.id });
      expect(res1.status).toBe(201);

      // Second vote should fail (FREE = 1 vote)
      const res2 = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(token))
        .send({ dishId: dishes[1].id, dailyCycleId: cycle.id });
      expect(res2.status).toBe(409); // already voted unique constraint
    });
  });

  describe("tier limits on orders", () => {
    it("enforces order limit for FREE users", async () => {
      const { user, token } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);
      const cycle = await createTestCycle(zone.id, CycleStatus.ORDERING);
      const dishes = await createTestDishes(cycle.id, 1);
      await prisma.dailyCycle.update({ where: { id: cycle.id }, data: { winningDishId: dishes[0].id } });
      await prisma.bid.create({
        data: { restaurantId: restaurant.id, dailyCycleId: cycle.id, dishId: dishes[0].id, pricePerPlate: 15, prepTime: 30, maxCapacity: 100, status: "WON" },
      });

      // Create 2 orders (FREE limit)
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .post("/api/orders")
          .set(getAuthHeader(token))
          .send({ dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, fulfillmentType: "PICKUP" });
        expect(res.status).toBe(201);
      }

      // Third order should fail
      const res3 = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(token))
        .send({ dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, fulfillmentType: "PICKUP" });
      expect(res3.status).toBe(429);
    });
  });
});
