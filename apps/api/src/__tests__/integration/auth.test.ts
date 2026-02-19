import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";

const app = createApp();

describe("Auth Routes — /api/auth", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user and return token", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@test.com", password: "password123", name: "New User", role: "CONSUMER" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("new@test.com");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe("CONSUMER");
    });

    it("should return 409 for duplicate email", async () => {
      await createTestUser(UserRole.CONSUMER, { email: "dupe@test.com" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "dupe@test.com", password: "password123", name: "Dupe User", role: "CONSUMER" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already registered");
    });

    it("should return 400 for invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "notanemail", password: "password123", name: "Test", role: "CONSUMER" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "x@test.com", password: "short", name: "Test", role: "CONSUMER" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with correct credentials", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER, { email: "login@test.com", password: "mypassword" });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "mypassword" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("login@test.com");
    });

    it("should return 401 for wrong password", async () => {
      await createTestUser(UserRole.CONSUMER, { email: "wrong@test.com", password: "correctpass" });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "wrong@test.com", password: "wrongpass" });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid credentials");
    });

    it("should return 401 for non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "noone@test.com", password: "anything" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return authenticated user profile", async () => {
      const { token, user } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.email).toBe(user.email);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });
  });
});
