import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant } from "../helpers/fixtures";

const app = createApp();

describe("Payment Routes — /api/payments", () => {
  let orderId: string;
  let consumerToken: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Ensure no Stripe key (dev mode)
    delete process.env.STRIPE_SECRET_KEY;

    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.ORDERING);
    const dishes = await createTestDishes(cycle.id, 1);
    await prisma.dailyCycle.update({
      where: { id: cycle.id },
      data: { winningDishId: dishes[0].id },
    });

    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);

    await prisma.bid.create({
      data: {
        restaurantId: restaurant.id,
        dailyCycleId: cycle.id,
        dishId: dishes[0].id,
        pricePerPlate: 15,
        prepTime: 30,
        maxCapacity: 100,
        status: "WON",
        score: 0.9,
      },
    });

    const { token } = await createTestUser(UserRole.CONSUMER);
    consumerToken = token;

    // Create an order (dev mode auto-confirms, so create it PENDING manually)
    const order = await prisma.order.create({
      data: {
        userId: (await prisma.user.findFirst({ where: { role: "CONSUMER" } }))!.id,
        dailyCycleId: cycle.id,
        restaurantId: restaurant.id,
        quantity: 2,
        totalPrice: 30,
        fulfillmentType: "PICKUP",
        status: "PENDING",
        items: {
          create: { dishId: dishes[0].id, quantity: 2, price: 15 },
        },
      },
    });
    orderId = order.id;
  });

  describe("POST /api/payments/create-checkout-session", () => {
    it("should auto-confirm order in dev mode (no Stripe key)", async () => {
      const res = await request(app)
        .post("/api/payments/create-checkout-session")
        .set(getAuthHeader(consumerToken))
        .send({ orderId });

      expect(res.status).toBe(200);
      expect(res.body.data.devMode).toBe(true);
      expect(res.body.data.order.status).toBe("CONFIRMED");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/payments/create-checkout-session")
        .send({ orderId });

      expect(res.status).toBe(401);
    });

    it("should return 400 without orderId", async () => {
      const res = await request(app)
        .post("/api/payments/create-checkout-session")
        .set(getAuthHeader(consumerToken))
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent order", async () => {
      const res = await request(app)
        .post("/api/payments/create-checkout-session")
        .set(getAuthHeader(consumerToken))
        .send({ orderId: "00000000-0000-0000-0000-000000000000" });

      expect(res.status).toBe(404);
    });

    it("should return 403 when user doesn't own the order", async () => {
      const { token: otherToken } = await createTestUser(UserRole.CONSUMER);
      const res = await request(app)
        .post("/api/payments/create-checkout-session")
        .set(getAuthHeader(otherToken))
        .send({ orderId });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/payments/session/:sessionId", () => {
    it("should return dev mode status when Stripe not configured", async () => {
      const res = await request(app)
        .get("/api/payments/session/cs_test_123")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.devMode).toBe(true);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .get("/api/payments/session/cs_test_123");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("should return 200 in dev mode", async () => {
      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ type: "checkout.session.completed" }));

      expect(res.status).toBe(200);
      expect(res.body.devMode).toBe(true);
    });
  });
});
