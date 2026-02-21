import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestRestaurant } from "../helpers/fixtures";

const app = createApp();

describe("Restaurant Routes — /api/restaurants", () => {
  let ownerToken: string;
  let ownerId: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    zoneId = zone.id;

    const { user: owner, token } = await createTestUser(UserRole.RESTAURANT_OWNER);
    ownerToken = token;
    ownerId = owner.id;
  });

  describe("POST /api/restaurants/enroll", () => {
    const enrollData = {
      businessName: "Test Bistro",
      businessLicenseNumber: "LIC12345",
      taxId: "12-3456789",
      ownerFullName: "John Doe",
      phone: "1234567890",
      email: "bistro@test.com",
      address: "123 Main St",
      city: "Test City",
      state: "TC",
      zipCode: "12345",
      cuisineTypes: ["Italian", "French"],
      seatingCapacity: 80,
      kitchenCapacity: 200,
      healthPermitNumber: "HP123",
      insurancePolicyNumber: "INS12345",
      yearsInOperation: 5,
      website: "https://testbistro.com",
      description: "A fine dining establishment",
    };

    it("should enroll a restaurant", async () => {
      const res = await request(app)
        .post("/api/restaurants/enroll")
        .set(getAuthHeader(ownerToken))
        .send({ ...enrollData, zoneId });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Test Bistro");
      expect(res.body.data.ownerId).toBe(ownerId);
    });

    it("should return 409 when already enrolled", async () => {
      await createTestRestaurant(ownerId, zoneId);

      const res = await request(app)
        .post("/api/restaurants/enroll")
        .set(getAuthHeader(ownerToken))
        .send({ ...enrollData, zoneId });

      expect(res.status).toBe(409);
    });

    it("should return 400 with invalid taxId format", async () => {
      const res = await request(app)
        .post("/api/restaurants/enroll")
        .set(getAuthHeader(ownerToken))
        .send({ ...enrollData, zoneId, taxId: "invalid" });

      expect(res.status).toBe(400);
    });

    it("should auto-upgrade consumer role to RESTAURANT_OWNER on enroll", async () => {
      const { user: consumer, token: consumerToken } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post("/api/restaurants/enroll")
        .set(getAuthHeader(consumerToken))
        .send({ ...enrollData, zoneId });

      expect(res.status).toBe(201);
      const updated = await prisma.user.findUnique({ where: { id: consumer.id } });
      expect(updated!.role).toBe(UserRole.RESTAURANT_OWNER);
    });
  });

  describe("GET /api/restaurants/mine", () => {
    it("should return the user's restaurant", async () => {
      await createTestRestaurant(ownerId, zoneId, { name: "My Restaurant" });

      const res = await request(app)
        .get("/api/restaurants/mine")
        .set(getAuthHeader(ownerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("My Restaurant");
    });

    it("should return 404 when user has no restaurant", async () => {
      const res = await request(app)
        .get("/api/restaurants/mine")
        .set(getAuthHeader(ownerToken));

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/restaurants/mine");

      expect(res.status).toBe(401);
    });
  });
});
