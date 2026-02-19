import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant } from "../helpers/fixtures";

const app = createApp();

describe("Review Routes — /api/reviews", () => {
  let consumerToken: string;
  let consumerId: string;
  let restaurantId: string;
  let orderId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zone.id);
    restaurantId = restaurant.id;

    const { user: consumer, token } = await createTestUser(UserRole.CONSUMER);
    consumerToken = token;
    consumerId = consumer.id;

    // Create a cycle, dish, and order for the consumer
    const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
    const dishes = await createTestDishes(cycle.id, 1);
    const order = await prisma.order.create({
      data: {
        userId: consumerId,
        dailyCycleId: cycle.id,
        restaurantId,
        quantity: 1,
        totalPrice: 15,
        fulfillmentType: "PICKUP",
        items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } },
      },
    });
    orderId = order.id;
  });

  describe("POST /api/reviews", () => {
    it("should create a review", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(getAuthHeader(consumerToken))
        .send({
          restaurantId,
          orderId,
          rating: 4,
          title: "Great food!",
          body: "The food was really delicious, would order again.",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.user.name).toBeDefined();
    });

    it("should update restaurant average rating after review", async () => {
      await request(app)
        .post("/api/reviews")
        .set(getAuthHeader(consumerToken))
        .send({
          restaurantId,
          orderId,
          rating: 4,
          title: "Pretty good",
          body: "Enjoyed the meal, great service overall.",
        });

      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      expect(restaurant!.rating).toBe(4);
    });

    it("should return 409 for duplicate review per order", async () => {
      await request(app)
        .post("/api/reviews")
        .set(getAuthHeader(consumerToken))
        .send({ restaurantId, orderId, rating: 4, title: "First review", body: "This is my first review of this order." });

      const res = await request(app)
        .post("/api/reviews")
        .set(getAuthHeader(consumerToken))
        .send({ restaurantId, orderId, rating: 5, title: "Second review", body: "Trying to review the same order again." });

      expect(res.status).toBe(409);
    });

    it("should create review without orderId", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(getAuthHeader(consumerToken))
        .send({ restaurantId, rating: 3, title: "Decent place", body: "Food was okay, nothing special to note." });

      expect(res.status).toBe(201);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .send({ restaurantId, rating: 4, title: "Test title here", body: "This is a test body for the review." });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/reviews/restaurant/:restaurantId", () => {
    it("should list reviews for a restaurant with average rating", async () => {
      await prisma.review.create({
        data: { userId: consumerId, restaurantId, rating: 4, title: "Good", body: "Very good meal, enjoyed it a lot." },
      });

      const res = await request(app).get(`/api/reviews/restaurant/${restaurantId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(1);
      expect(res.body.data.averageRating).toBe(4);
      expect(res.body.data.total).toBe(1);
    });

    it("should return empty array and 0 avg when no reviews", async () => {
      const res = await request(app).get(`/api/reviews/restaurant/${restaurantId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(0);
      expect(res.body.data.averageRating).toBe(0);
    });
  });

  describe("GET /api/reviews/mine", () => {
    it("should return reviews by authenticated user", async () => {
      await prisma.review.create({
        data: { userId: consumerId, restaurantId, rating: 5, title: "Amazing!", body: "Best food I have ever had in my life." },
      });

      const res = await request(app)
        .get("/api/reviews/mine")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
