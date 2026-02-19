import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes } from "../helpers/fixtures";

const app = createApp();

describe("Cycle Routes — /api/cycles", () => {
  let adminToken: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const { token } = await createTestUser(UserRole.ADMIN);
    adminToken = token;
    const zone = await createTestZone();
    zoneId = zone.id;
  });

  describe("POST /api/cycles/create", () => {
    it("should create a cycle (admin only)", async () => {
      const res = await request(app)
        .post("/api/cycles/create")
        .set(getAuthHeader(adminToken))
        .send({ zoneId });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("SUGGESTING");
      expect(res.body.data.zoneId).toBe(zoneId);
    });

    it("should return 403 for non-admin", async () => {
      const { token } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post("/api/cycles/create")
        .set(getAuthHeader(token))
        .send({ zoneId });

      expect(res.status).toBe(403);
    });

    it("should return 409 if cycle already exists for today", async () => {
      await request(app)
        .post("/api/cycles/create")
        .set(getAuthHeader(adminToken))
        .send({ zoneId });

      const res = await request(app)
        .post("/api/cycles/create")
        .set(getAuthHeader(adminToken))
        .send({ zoneId });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/cycles/today", () => {
    it("should return today's cycle for a zone", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cycle = await createTestCycle(zoneId, CycleStatus.VOTING, { date: today });
      await createTestDishes(cycle.id, 3);

      const res = await request(app).get(`/api/cycles/today?zoneId=${zoneId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(cycle.id);
      expect(res.body.data.dishes).toHaveLength(3);
    });

    it("should return 400 without zoneId", async () => {
      const res = await request(app).get("/api/cycles/today");

      expect(res.status).toBe(400);
    });

    it("should return 404 when no cycle exists for today", async () => {
      const res = await request(app).get(`/api/cycles/today?zoneId=${zoneId}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/cycles/today/status", () => {
    it("should return lightweight status with counts", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cycle = await createTestCycle(zoneId, CycleStatus.VOTING, { date: today });
      await createTestDishes(cycle.id, 2);

      const res = await request(app).get(`/api/cycles/today/status?zoneId=${zoneId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("VOTING");
      expect(res.body.data._count.dishes).toBe(2);
    });
  });

  describe("POST /api/cycles/transition", () => {
    it("should transition from SUGGESTING to CANCELLED (no side-effects)", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/cycles/transition")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id, targetStatus: "CANCELLED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELLED");
    });

    it("should reject invalid transitions", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/cycles/transition")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id, targetStatus: "ORDERING" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot transition");
    });

    it("should reject invalid targetStatus values", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/cycles/transition")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id, targetStatus: "INVALID" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/cycles/:id", () => {
    it("should return cycle details with dishes", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 3);

      const res = await request(app).get(`/api/cycles/${cycle.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.dishes).toHaveLength(3);
      expect(res.body.data.zone.name).toBeDefined();
    });

    it("should return 404 for non-existent cycle", async () => {
      const res = await request(app).get("/api/cycles/nonexistent-id");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/cycles/:id/summary", () => {
    it("should return summary with counts", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.VOTING);
      await createTestDishes(cycle.id, 2);

      const res = await request(app).get(`/api/cycles/${cycle.id}/summary`);

      expect(res.status).toBe(200);
      expect(res.body.data.zoneName).toBeDefined();
      expect(res.body.data.counts).toBeDefined();
    });
  });
});
