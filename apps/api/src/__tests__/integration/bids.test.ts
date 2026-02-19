import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant } from "../helpers/fixtures";

const app = createApp();

describe("Bid Routes — /api/bids", () => {
  let cycleId: string;
  let dishId: string;
  let ownerToken: string;
  let restaurantId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.BIDDING);
    cycleId = cycle.id;
    const dishes = await createTestDishes(cycleId, 1);
    dishId = dishes[0].id;

    const { user: owner, token } = await createTestUser(UserRole.RESTAURANT_OWNER);
    ownerToken = token;
    const restaurant = await createTestRestaurant(owner.id, zone.id);
    restaurantId = restaurant.id;
  });

  describe("POST /api/bids", () => {
    it("should submit a bid successfully", async () => {
      const res = await request(app)
        .post("/api/bids")
        .set(getAuthHeader(ownerToken))
        .send({
          restaurantId,
          dailyCycleId: cycleId,
          dishId,
          pricePerPlate: 15,
          prepTime: 30,
          maxCapacity: 100,
          serviceFeeAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.restaurantId).toBe(restaurantId);
      expect(res.body.data.status).toBe("PENDING");
    });

    it("should return 403 for non-restaurant-owner", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post("/api/bids")
        .set(getAuthHeader(consumerToken))
        .send({
          restaurantId,
          dailyCycleId: cycleId,
          dishId,
          pricePerPlate: 15,
          prepTime: 30,
          maxCapacity: 100,
          serviceFeeAccepted: true,
        });

      expect(res.status).toBe(403);
    });

    it("should return 400 when cycle is not in BIDDING phase", async () => {
      const zone = await createTestZone();
      const votingCycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(votingCycle.id, 1);

      const res = await request(app)
        .post("/api/bids")
        .set(getAuthHeader(ownerToken))
        .send({
          restaurantId,
          dailyCycleId: votingCycle.id,
          dishId: dishes[0].id,
          pricePerPlate: 15,
          prepTime: 30,
          maxCapacity: 100,
          serviceFeeAccepted: true,
        });

      expect(res.status).toBe(400);
    });

    it("should return 409 for duplicate bid", async () => {
      const bidData = {
        restaurantId,
        dailyCycleId: cycleId,
        dishId,
        pricePerPlate: 15,
        prepTime: 30,
        maxCapacity: 100,
        serviceFeeAccepted: true,
      };

      await request(app).post("/api/bids").set(getAuthHeader(ownerToken)).send(bidData);
      const res = await request(app).post("/api/bids").set(getAuthHeader(ownerToken)).send(bidData);

      expect(res.status).toBe(409);
    });

    it("should return 403 when restaurant doesn't belong to user", async () => {
      const { user: otherOwner, token: otherToken } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const zone = await createTestZone();
      await createTestRestaurant(otherOwner.id, zone.id);

      const res = await request(app)
        .post("/api/bids")
        .set(getAuthHeader(otherToken))
        .send({
          restaurantId, // belongs to original owner
          dailyCycleId: cycleId,
          dishId,
          pricePerPlate: 15,
          prepTime: 30,
          maxCapacity: 100,
          serviceFeeAccepted: true,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/bids/:cycleId", () => {
    it("should list bids for a cycle", async () => {
      await prisma.bid.create({
        data: { restaurantId, dailyCycleId: cycleId, dishId, pricePerPlate: 15, prepTime: 30, maxCapacity: 100 },
      });

      const res = await request(app)
        .get(`/api/bids/${cycleId}`)
        .set(getAuthHeader(ownerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /api/bids/:cycleId/winner", () => {
    it("should return the winning bid", async () => {
      await prisma.bid.create({
        data: { restaurantId, dailyCycleId: cycleId, dishId, pricePerPlate: 15, prepTime: 30, maxCapacity: 100, status: "WON", score: 0.95 },
      });

      const res = await request(app).get(`/api/bids/${cycleId}/winner`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("WON");
    });

    it("should return 404 when no winner exists", async () => {
      const res = await request(app).get(`/api/bids/${cycleId}/winner`);

      expect(res.status).toBe(404);
    });
  });
});
