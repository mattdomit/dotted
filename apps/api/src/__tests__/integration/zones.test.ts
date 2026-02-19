import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone } from "../helpers/fixtures";

const app = createApp();

describe("Zone Routes — /api/zones", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("GET /api/zones", () => {
    it("should list all active zones", async () => {
      await createTestZone({ name: "Zone A" });
      await createTestZone({ name: "Zone B" });

      const res = await request(app).get("/api/zones");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it("should not list inactive zones", async () => {
      await createTestZone({ name: "Active Zone" });
      const { prisma } = await import("@dotted/db");
      const inactive = await createTestZone({ name: "Inactive Zone" });
      await prisma.zone.update({ where: { id: inactive.id }, data: { isActive: false } });

      const res = await request(app).get("/api/zones");

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Active Zone");
    });
  });

  describe("GET /api/zones/:id", () => {
    it("should return zone with membership/restaurant/supplier counts", async () => {
      const zone = await createTestZone();
      const { user } = await createTestUser(UserRole.CONSUMER);
      const { prisma } = await import("@dotted/db");
      await prisma.zoneMembership.create({ data: { userId: user.id, zoneId: zone.id } });

      const res = await request(app).get(`/api/zones/${zone.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(zone.id);
      expect(res.body.data._count.memberships).toBe(1);
    });

    it("should return 404 for non-existent zone", async () => {
      const res = await request(app).get("/api/zones/nonexistent-id");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/zones/:id/join", () => {
    it("should join a zone", async () => {
      const zone = await createTestZone();
      const { token } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post(`/api/zones/${zone.id}/join`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.zoneId).toBe(zone.id);
    });

    it("should be idempotent (joining twice returns success)", async () => {
      const zone = await createTestZone();
      const { token } = await createTestUser(UserRole.CONSUMER);

      await request(app).post(`/api/zones/${zone.id}/join`).set(getAuthHeader(token));
      const res = await request(app).post(`/api/zones/${zone.id}/join`).set(getAuthHeader(token));

      expect(res.status).toBe(200);
    });

    it("should return 401 without authentication", async () => {
      const zone = await createTestZone();

      const res = await request(app).post(`/api/zones/${zone.id}/join`);

      expect(res.status).toBe(401);
    });

    it("should return 404 for non-existent zone", async () => {
      const { token } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post("/api/zones/nonexistent-id/join")
        .set(getAuthHeader(token));

      expect(res.status).toBe(404);
    });
  });
});
