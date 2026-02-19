import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../helpers/fixtures";
import { createMockAnthropicResponse, createSampleDishSuggestions } from "../helpers/mocks";
import { prisma } from "@dotted/db";

// Mock the Anthropic SDK at module level — use vi.hoisted to survive mock hoisting
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

const app = createApp();

describe("AI Routes — /api/ai", () => {
  let adminToken: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();
    mockCreate.mockReset();
    const { token } = await createTestUser(UserRole.ADMIN);
    adminToken = token;
    const zone = await createTestZone();
    zoneId = zone.id;
  });

  describe("POST /api/ai/suggest-dishes", () => {
    it("should suggest dishes with mocked AI (admin only)", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);
      const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
      await createTestSupplierWithInventory(supplierOwner.id, zoneId);

      const sampleDishes = createSampleDishSuggestions(3);
      mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

      const res = await request(app)
        .post("/api/ai/suggest-dishes")
        .set(getAuthHeader(adminToken))
        .send({ zoneId, cycleId: cycle.id });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });

    it("should return 403 for non-admin", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);
      const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);

      const res = await request(app)
        .post("/api/ai/suggest-dishes")
        .set(getAuthHeader(consumerToken))
        .send({ zoneId, cycleId: cycle.id });

      expect(res.status).toBe(403);
    });

    it("should return 400 when missing required fields", async () => {
      const res = await request(app)
        .post("/api/ai/suggest-dishes")
        .set(getAuthHeader(adminToken))
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/ai/optimize-sourcing", () => {
    it("should optimize sourcing with mocked AI (admin only)", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SOURCING);
      const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
      await createTestSupplierWithInventory(supplierOwner.id, zoneId);

      // Create a winning dish with matching ingredients
      const dish = await prisma.dish.create({
        data: {
          dailyCycleId: cycle.id,
          name: "Test Dish",
          description: "A dish",
          cuisine: "Italian",
          estimatedCost: 12,
          voteCount: 5,
          ingredients: {
            create: [{ name: "Tomatoes", quantity: 5, unit: "kg", category: "Produce", substitutes: [] }],
          },
        },
      });
      await prisma.dailyCycle.update({ where: { id: cycle.id }, data: { winningDishId: dish.id } });

      const res = await request(app)
        .post("/api/ai/optimize-sourcing")
        .set(getAuthHeader(adminToken))
        .send({ cycleId: cycle.id });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should return 403 for non-admin", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);
      const cycle = await createTestCycle(zoneId, CycleStatus.SOURCING);

      const res = await request(app)
        .post("/api/ai/optimize-sourcing")
        .set(getAuthHeader(consumerToken))
        .send({ cycleId: cycle.id });

      expect(res.status).toBe(403);
    });
  });
});
