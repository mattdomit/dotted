import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestVerificationCode } from "../helpers/fixtures";

const app = createApp();

describe("Verification", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("register returns emailVerified: false", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@test.com", password: "TestPass123!", name: "New User", role: "CONSUMER" });

    expect(res.status).toBe(201);
    expect(res.body.data.user.emailVerified).toBe(false);
  });

  it("verify with valid code sets emailVerified: true", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER, { emailVerified: false });

    // Create a verification code
    await createTestVerificationCode(user.id, "EMAIL", { code: "123456" });

    const res = await request(app)
      .post("/api/auth/verify")
      .set(getAuthHeader(token))
      .send({ code: "123456", type: "EMAIL" });

    expect(res.status).toBe(200);
    expect(res.body.data.emailVerified).toBe(true);
    expect(res.body.data.token).toBeDefined();

    // Verify DB updated
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.emailVerified).toBe(true);
  });

  it("reject expired verification code", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER, { emailVerified: false });

    await createTestVerificationCode(user.id, "EMAIL", {
      code: "654321",
      expiresAt: new Date(Date.now() - 60000), // expired
    });

    const res = await request(app)
      .post("/api/auth/verify")
      .set(getAuthHeader(token))
      .send({ code: "654321", type: "EMAIL" });

    expect(res.status).toBe(400);
  });

  it("enforce resend cooldown", async () => {
    const { user, token } = await createTestUser(UserRole.CONSUMER, { emailVerified: false });

    // Create recent verification code
    await createTestVerificationCode(user.id, "EMAIL");

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .set(getAuthHeader(token))
      .send({ type: "EMAIL" });

    expect(res.status).toBe(429);
  });

  it("unverified user blocked from voting", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER, { emailVerified: false });
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
    const dishes = await createTestDishes(cycle.id, 2);

    const res = await request(app)
      .post("/api/votes")
      .set(getAuthHeader(token))
      .send({ dishId: dishes[0].id, dailyCycleId: cycle.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("verification");
  });

  it("verified user can vote", async () => {
    const { token } = await createTestUser(UserRole.CONSUMER, { emailVerified: true });
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
    const dishes = await createTestDishes(cycle.id, 2);

    const res = await request(app)
      .post("/api/votes")
      .set(getAuthHeader(token))
      .send({ dishId: dishes[0].id, dailyCycleId: cycle.id });

    expect(res.status).toBe(201);
  });

  it("test-mode bypass with code 000000", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    const { user, token } = await createTestUser(UserRole.CONSUMER, { emailVerified: false });

    const res = await request(app)
      .post("/api/auth/verify")
      .set(getAuthHeader(token))
      .send({ code: "000000", type: "EMAIL" });

    expect(res.status).toBe(200);
    expect(res.body.data.emailVerified).toBe(true);

    process.env.NODE_ENV = originalEnv;
  });
});
