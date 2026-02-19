import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { getProcurementSummary, updatePurchaseOrderStatus } from "../../../services/procurement";
import { cleanDatabase } from "../../helpers/db";
import { createTestUser } from "../../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../../helpers/fixtures";

describe("Procurement Service", () => {
  let cycleId: string;
  let supplierId: string;
  let inventoryItemId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.SOURCING);
    cycleId = cycle.id;

    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    const { supplier, inventory } = await createTestSupplierWithInventory(supplierOwner.id, zone.id);
    supplierId = supplier.id;
    inventoryItemId = inventory[0].id;
  });

  describe("getProcurementSummary", () => {
    it("should return structured data with line totals", async () => {
      // Create a purchase order with items
      await prisma.purchaseOrder.create({
        data: {
          dailyCycleId: cycleId,
          supplierId,
          totalCost: 35,
          items: {
            create: [
              { inventoryItemId, quantity: 10, unitPrice: 3.5 },
            ],
          },
        },
      });

      const summary = await getProcurementSummary(cycleId);

      expect(summary).toHaveLength(1);
      expect(summary[0].totalCost).toBe(35);
      expect(summary[0].items).toHaveLength(1);
      expect(summary[0].items[0].lineTotal).toBe(35); // 10 * 3.5
      expect(summary[0].status).toBe("PENDING");
    });

    it("should return empty array when no purchase orders", async () => {
      const summary = await getProcurementSummary(cycleId);
      expect(summary).toHaveLength(0);
    });

    it("should return multiple orders when grouped by supplier", async () => {
      const { user: s2 } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();
      const { supplier: supplier2, inventory: inv2 } = await createTestSupplierWithInventory(s2.id, zone.id);

      await prisma.purchaseOrder.create({
        data: { dailyCycleId: cycleId, supplierId, totalCost: 35, items: { create: [{ inventoryItemId, quantity: 10, unitPrice: 3.5 }] } },
      });
      await prisma.purchaseOrder.create({
        data: { dailyCycleId: cycleId, supplierId: supplier2.id, totalCost: 50, items: { create: [{ inventoryItemId: inv2[0].id, quantity: 5, unitPrice: 10 }] } },
      });

      const summary = await getProcurementSummary(cycleId);
      expect(summary).toHaveLength(2);
    });
  });

  describe("updatePurchaseOrderStatus", () => {
    it("should update PENDING to CONFIRMED", async () => {
      const po = await prisma.purchaseOrder.create({
        data: { dailyCycleId: cycleId, supplierId, totalCost: 35, items: { create: [{ inventoryItemId, quantity: 10, unitPrice: 3.5 }] } },
      });

      const updated = await updatePurchaseOrderStatus(po.id, "CONFIRMED");
      expect(updated.status).toBe("CONFIRMED");
    });

    it("should update CONFIRMED to SHIPPED", async () => {
      const po = await prisma.purchaseOrder.create({
        data: { dailyCycleId: cycleId, supplierId, totalCost: 35, status: "CONFIRMED", items: { create: [{ inventoryItemId, quantity: 10, unitPrice: 3.5 }] } },
      });

      const updated = await updatePurchaseOrderStatus(po.id, "SHIPPED");
      expect(updated.status).toBe("SHIPPED");
    });

    it("should update SHIPPED to DELIVERED", async () => {
      const po = await prisma.purchaseOrder.create({
        data: { dailyCycleId: cycleId, supplierId, totalCost: 35, status: "SHIPPED", items: { create: [{ inventoryItemId, quantity: 10, unitPrice: 3.5 }] } },
      });

      const updated = await updatePurchaseOrderStatus(po.id, "DELIVERED");
      expect(updated.status).toBe("DELIVERED");
    });
  });
});
