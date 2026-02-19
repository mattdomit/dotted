import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes } from "../helpers/fixtures";

const app = createApp();

describe("Vote Routes — /api/votes", () => {
  let cycleId: string;
  let dishId: string;
  let consumerToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
    cycleId = cycle.id;
    const dishes = await createTestDishes(cycleId, 3);
    dishId = dishes[0].id;
    const { token } = await createTestUser(UserRole.CONSUMER);
    consumerToken = token;
  });

  describe("POST /api/votes", () => {
    it("should cast a vote successfully", async () => {
      const res = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId, dailyCycleId: cycleId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dishId).toBe(dishId);

      // Verify vote count incremented
      const dish = await prisma.dish.findUnique({ where: { id: dishId } });
      expect(dish!.voteCount).toBe(1);
    });

    it("should return 400 when cycle is not in VOTING phase", async () => {
      const zone = await createTestZone();
      const biddingCycle = await createTestCycle(zone.id, CycleStatus.BIDDING);
      const dishes = await createTestDishes(biddingCycle.id, 1);

      const res = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId: dishes[0].id, dailyCycleId: biddingCycle.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("not open");
    });

    it("should return 404 for non-existent dish", async () => {
      const res = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId: "00000000-0000-0000-0000-000000000000", dailyCycleId: cycleId });

      expect(res.status).toBe(404);
    });

    it("should return 409 for duplicate vote in same cycle", async () => {
      await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId, dailyCycleId: cycleId });

      const res = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId, dailyCycleId: cycleId });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already voted");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/votes")
        .send({ dishId, dailyCycleId: cycleId });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/votes/live/:cycleId", () => {
    it("should return live vote results", async () => {
      // Cast a vote first
      await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumerToken))
        .send({ dishId, dailyCycleId: cycleId });

      const res = await request(app).get(`/api/votes/live/${cycleId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalVotes).toBe(1);
      expect(res.body.data.dishes).toHaveLength(3);
    });

    it("should return zero votes when none cast", async () => {
      const res = await request(app).get(`/api/votes/live/${cycleId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalVotes).toBe(0);
    });
  });
});
