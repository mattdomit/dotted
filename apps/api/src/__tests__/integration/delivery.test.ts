import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../helpers/fixtures";
import { prisma } from "@dotted/db";

// Mock socket handlers
vi.mock("../../socket/handlers", () => ({
  getIO: vi.fn().mockReturnValue(null),
}));

const app = createApp();

describe("Delivery Tracking", () => {
  let supplierToken: string;
  let supplierId: string;
  let poId: string;
  let zoneId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const zone = await createTestZone();
    zoneId = zone.id;

    const { token, user } = await createTestUser(UserRole.SUPPLIER);
    supplierToken = token;

    const { supplier, inventory } = await createTestSupplierWithInventory(user.id, zone.id);
    supplierId = supplier.id;

    // Create a cycle with a purchase order
    const cycle = await createTestCycle(zone.id, CycleStatus.SOURCING);

    const po = await prisma.purchaseOrder.create({
      data: {
        dailyCycleId: cycle.id,
        supplierId: supplier.id,
        status: "CONFIRMED",
        totalCost: 100,
        deliveryEta: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: {
          create: {
            inventoryItemId: inventory[0].id,
            quantity: 10,
            unitPrice: 3.5,
          },
        },
      },
    });
    poId = po.id;
  });

  it("create delivery tracking entry", async () => {
    const res = await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(supplierToken))
      .send({ status: "DISPATCHED", note: "On the way!" });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DISPATCHED");
    expect(res.body.data.note).toBe("On the way!");
  });

  it("get tracking history", async () => {
    // Create multiple tracking entries
    await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(supplierToken))
      .send({ status: "DISPATCHED" });
    await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(supplierToken))
      .send({ status: "IN_TRANSIT", latitude: 40.7, longitude: -74.0 });

    const res = await request(app)
      .get(`/api/delivery/purchase-orders/${poId}/tracking`)
      .set(getAuthHeader(supplierToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].status).toBe("DISPATCHED");
    expect(res.body.data[1].status).toBe("IN_TRANSIT");
    expect(res.body.data[1].latitude).toBe(40.7);
  });

  it("delivered status updates PO and recalculates supplier metrics", async () => {
    const res = await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(supplierToken))
      .send({ status: "DELIVERED" });

    expect(res.status).toBe(201);

    // Verify PO status updated
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    expect(po!.status).toBe("DELIVERED");
    expect(po!.actualDeliveryTime).toBeDefined();

    // Verify supplier metrics updated
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    expect(supplier!.fulfillmentRate).toBeGreaterThan(0);
  });

  it("get supplier metrics", async () => {
    // Deliver the order first
    await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(supplierToken))
      .send({ status: "DELIVERED" });

    const res = await request(app)
      .get(`/api/delivery/suppliers/${supplierId}/metrics`)
      .set(getAuthHeader(supplierToken));

    expect(res.status).toBe(200);
    expect(res.body.data.totalDeliveries).toBe(1);
    expect(res.body.data.fulfillmentRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.onTimeRate).toBeGreaterThanOrEqual(0);
  });

  it("non-owner supplier cannot update delivery", async () => {
    const { token: otherToken } = await createTestUser(UserRole.SUPPLIER);

    const res = await request(app)
      .patch(`/api/delivery/purchase-orders/${poId}/delivery`)
      .set(getAuthHeader(otherToken))
      .send({ status: "DISPATCHED" });

    expect(res.status).toBe(403);
  });
});
