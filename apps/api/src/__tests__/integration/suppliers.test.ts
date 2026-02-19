import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../helpers/fixtures";

const app = createApp();

describe("Supplier Routes — /api/suppliers", () => {
  let supplierToken: string;
  let supplierId: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    zoneId = zone.id;

    const { user: supplierOwner, token } = await createTestUser(UserRole.SUPPLIER);
    supplierToken = token;
    const { supplier } = await createTestSupplierWithInventory(supplierOwner.id, zoneId);
    supplierId = supplier.id;
  });

  describe("GET /api/suppliers/inventory", () => {
    it("should return inventory for the supplier", async () => {
      const res = await request(app)
        .get("/api/suppliers/inventory")
        .set(getAuthHeader(supplierToken));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].ingredientName).toBeDefined();
    });

    it("should return 403 for non-supplier role", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .get("/api/suppliers/inventory")
        .set(getAuthHeader(consumerToken));

      expect(res.status).toBe(403);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/suppliers/inventory");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/suppliers/inventory", () => {
    it("should add inventory items", async () => {
      const res = await request(app)
        .post("/api/suppliers/inventory")
        .set(getAuthHeader(supplierToken))
        .send({
          items: [
            { ingredientName: "Carrots", category: "Produce", unit: "kg", pricePerUnit: 2.5, quantityAvailable: 50 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(1);
    });

    it("should return 400 with empty items array", async () => {
      const res = await request(app)
        .post("/api/suppliers/inventory")
        .set(getAuthHeader(supplierToken))
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it("should return 403 for non-supplier", async () => {
      const { token: consumerToken } = await createTestUser(UserRole.CONSUMER);

      const res = await request(app)
        .post("/api/suppliers/inventory")
        .set(getAuthHeader(consumerToken))
        .send({ items: [{ ingredientName: "X", category: "Y", unit: "kg", pricePerUnit: 1, quantityAvailable: 1 }] });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/suppliers/orders", () => {
    it("should return purchase orders for the supplier", async () => {
      const cycle = await createTestCycle(zoneId, CycleStatus.SOURCING);
      const inv = await prisma.supplierInventory.findFirst({ where: { supplierId } });

      await prisma.purchaseOrder.create({
        data: {
          dailyCycleId: cycle.id,
          supplierId,
          totalCost: 50,
          items: { create: [{ inventoryItemId: inv!.id, quantity: 10, unitPrice: 5 }] },
        },
      });

      const res = await request(app)
        .get("/api/suppliers/orders")
        .set(getAuthHeader(supplierToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
