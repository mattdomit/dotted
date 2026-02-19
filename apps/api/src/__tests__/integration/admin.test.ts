import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle } from "../helpers/fixtures";

const app = createApp();

describe("Admin Routes — /api/admin", () => {
  let adminToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    const { token } = await createTestUser(UserRole.ADMIN);
    adminToken = token;
  });

  describe("GET /api/admin/analytics", () => {
    it("should return analytics totals", async () => {
      // Create some data
      await createTestUser(UserRole.CONSUMER);
      await createTestUser(UserRole.RESTAURANT_OWNER);
      const zone = await createTestZone();
      await createTestCycle(zone.id, CycleStatus.VOTING);

      const res = await request(app)
        .get("/api/admin/analytics")
        .set(getAuthHeader(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.totals).toBeDefined();
      expect(res.body.data.totals.users).toBeGreaterThanOrEqual(3); // admin + consumer + owner
      expect(res.body.data.totals.cycles).toBeGreaterThanOrEqual(1);
    });

    it("should return 403 for non-admin", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .get("/api/admin/analytics")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(403);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/admin/analytics");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/admin/cycles/override", () => {
    it("should override cycle status", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/admin/cycles/override")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id, action: "CANCELLED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELLED");
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/admin/cycles/override")
        .set(getAuthHeader(adminToken))
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid action", async () => {
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/admin/cycles/override")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id, action: "INVALID_STATUS" });

      expect(res.status).toBe(400);
    });

    it("should return 403 for non-admin", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/admin/cycles/override")
        .set(getAuthHeader(consumerToken))
        .send({ cycleId: cycle.id, action: "CANCELLED" });

      expect(res.status).toBe(403);
    });
  });
});
