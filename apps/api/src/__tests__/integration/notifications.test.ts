import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";

const app = createApp();

describe("Notification Routes — /api/notifications", () => {
  let userId: string;
  let userToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    const { user, token } = await createTestUser(UserRole.CONSUMER);
    userId = user.id;
    userToken = token;
  });

  describe("GET /api/notifications", () => {
    it("should return empty array when no notifications", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return notifications for the user", async () => {
      await prisma.notification.createMany({
        data: [
          { userId, type: "ORDER_CREATED", title: "Order Placed", body: "Your order was placed.", channel: "IN_APP", status: "SENT" },
          { userId, type: "CYCLE_PHASE", title: "Voting Open", body: "Cast your vote.", channel: "IN_APP", status: "SENT" },
        ],
      });

      const res = await request(app)
        .get("/api/notifications")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("should not return other users' notifications", async () => {
      const { user: other } = await createTestUser(UserRole.CONSUMER);
      await prisma.notification.create({
        data: { userId: other.id, type: "TEST", title: "Private", body: "Not yours.", channel: "IN_APP", status: "SENT" },
      });

      const res = await request(app)
        .get("/api/notifications")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("should return 0 when no unread notifications", async () => {
      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });

    it("should count only unread notifications", async () => {
      await prisma.notification.createMany({
        data: [
          { userId, type: "TEST", title: "Unread 1", body: ".", channel: "IN_APP", status: "SENT" },
          { userId, type: "TEST", title: "Unread 2", body: ".", channel: "IN_APP", status: "SENT" },
          { userId, type: "TEST", title: "Read", body: ".", channel: "IN_APP", status: "SENT", readAt: new Date() },
        ],
      });

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      const notif = await prisma.notification.create({
        data: { userId, type: "TEST", title: "Mark Me", body: ".", channel: "IN_APP", status: "SENT" },
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it("should return 404 for non-existent notification", async () => {
      const res = await request(app)
        .patch("/api/notifications/00000000-0000-0000-0000-000000000000/read")
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(404);
    });

    it("should return 403 when marking another user's notification", async () => {
      const { user: other } = await createTestUser(UserRole.CONSUMER);
      const notif = await prisma.notification.create({
        data: { userId: other.id, type: "TEST", title: "Not Yours", body: ".", channel: "IN_APP", status: "SENT" },
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set(getAuthHeader(userToken));

      expect(res.status).toBe(403);
    });
  });
});
