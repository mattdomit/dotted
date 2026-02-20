import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant } from "../helpers/fixtures";

const app = createApp();

describe("Order Routes — /api/orders", () => {
  let cycleId: string;
  let restaurantId: string;
  let consumerToken: string;
  let ownerToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.ORDERING);
    cycleId = cycle.id;

    const dishes = await createTestDishes(cycleId, 1);
    await prisma.dailyCycle.update({ where: { id: cycleId }, data: { winningDishId: dishes[0].id } });

    const { user: owner, token: oToken } = await createTestUser(UserRole.RESTAURANT_OWNER);
    ownerToken = oToken;
    const restaurant = await createTestRestaurant(owner.id, zone.id);
    restaurantId = restaurant.id;

    // Create a winning bid
    await prisma.bid.create({
      data: { restaurantId, dailyCycleId: cycleId, dishId: dishes[0].id, pricePerPlate: 15, prepTime: 30, maxCapacity: 100, status: "WON", score: 0.9 },
    });

    const { token } = await createTestUser(UserRole.CONSUMER);
    consumerToken = token;
  });

  describe("POST /api/orders", () => {
    it("should place an order with correct price calculation", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumerToken))
        .send({ dailyCycleId: cycleId, restaurantId, quantity: 3, fulfillmentType: "PICKUP" });

      expect(res.status).toBe(201);
      expect(res.body.data.totalPrice).toBe(45); // 15 * 3
      expect(res.body.data.quantity).toBe(3);
      // Dev mode (no STRIPE_SECRET_KEY): orders auto-confirm
      expect(res.body.data.status).toBe("CONFIRMED");
    });

    it("should return 400 when cycle is not in ORDERING phase", async () => {
      const zone = await createTestZone();
      const votingCycle = await createTestCycle(zone.id, CycleStatus.VOTING);

      const res = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumerToken))
        .send({ dailyCycleId: votingCycle.id, restaurantId, quantity: 1, fulfillmentType: "PICKUP" });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/orders")
        .send({ dailyCycleId: cycleId, restaurantId, quantity: 1, fulfillmentType: "PICKUP" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/orders/mine", () => {
    it("should return orders for authenticated user", async () => {
      await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumerToken))
        .send({ dailyCycleId: cycleId, restaurantId, quantity: 1, fulfillmentType: "PICKUP" });

      const res = await request(app)
        .get("/api/orders/mine")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("should return empty array when no orders", async () => {
      const res = await request(app)
        .get("/api/orders/mine")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("PATCH /api/orders/:id/status", () => {
    it("should update order status (restaurant owner)", async () => {
      const orderRes = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumerToken))
        .send({ dailyCycleId: cycleId, restaurantId, quantity: 1, fulfillmentType: "PICKUP" });

      const orderId = orderRes.body.data.id;

      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set(getAuthHeader(ownerToken))
        .send({ status: "CONFIRMED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CONFIRMED");
    });

    it("should return 403 for non-restaurant-owner", async () => {
      const orderRes = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumerToken))
        .send({ dailyCycleId: cycleId, restaurantId, quantity: 1, fulfillmentType: "PICKUP" });

      const orderId = orderRes.body.data.id;

      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set(getAuthHeader(consumerToken))
        .send({ status: "CONFIRMED" });

      expect(res.status).toBe(403);
    });
  });
});
