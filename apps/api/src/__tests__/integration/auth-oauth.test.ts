import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";

const app = createApp();

describe("Auth OAuth — /api/auth/google", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("should return 501 when Google OAuth is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(501);
  });

  it("should return 501 on callback when OAuth is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await request(app).get("/api/auth/google/callback");
    expect(res.status).toBe(501);
  });

  it("should reject login with password for OAuth-only user", async () => {
    // Create a user without passwordHash (OAuth-only)
    await prisma.user.create({
      data: {
        email: "oauth@test.com",
        name: "OAuth User",
        role: "CONSUMER",
        googleId: "google-123",
      },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "oauth@test.com", password: "anything" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Google sign-in");
  });

  it("should still allow password login for users with passwordHash", async () => {
    const { user, password } = await createTestUser(UserRole.CONSUMER, { email: "normal@test.com" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "normal@test.com", password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });
});
