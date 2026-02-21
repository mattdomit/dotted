import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestBid } from "./helpers/fixtures";

describe("Enhanced Supplier Matching", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("inventory v2 fields", () => {
    it("creates inventory with freshnessWindow and qualityGrade", async () => {
      const { user: owner } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();
      const supplier = await prisma.supplier.create({
        data: {
          ownerId: owner.id,
          businessName: "Fresh Farms",
          address: "1 Farm Rd",
          rating: 4.5,
          zoneId: zone.id,
          temperatureControl: true,
        },
      });

      const item = await prisma.supplierInventory.create({
        data: {
          supplierId: supplier.id,
          ingredientName: "Organic Tomatoes",
          category: "Produce",
          unit: "kg",
          pricePerUnit: 4.0,
          quantityAvailable: 50,
          isOrganic: true,
          freshnessWindow: 48,
          storageType: "refrigerated",
          qualityGrade: "A",
        },
      });

      expect(item.freshnessWindow).toBe(48);
      expect(item.qualityGrade).toBe("A");
      expect(item.storageType).toBe("refrigerated");
    });

    it("creates inventory with bulk discount fields", async () => {
      const { user: owner } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();
      const supplier = await prisma.supplier.create({
        data: {
          ownerId: owner.id,
          businessName: "Bulk Supplier",
          address: "2 Warehouse Ave",
          rating: 4.0,
          zoneId: zone.id,
        },
      });

      const item = await prisma.supplierInventory.create({
        data: {
          supplierId: supplier.id,
          ingredientName: "Rice",
          category: "Grain",
          unit: "kg",
          pricePerUnit: 2.0,
          quantityAvailable: 500,
          minimumOrderQty: 10,
          bulkDiscountQty: 50,
          bulkDiscountRate: 0.15,
        },
      });

      expect(item.minimumOrderQty).toBe(10);
      expect(item.bulkDiscountQty).toBe(50);
      expect(item.bulkDiscountRate).toBe(0.15);
    });
  });

  describe("supplier v2 fields", () => {
    it("creates supplier with delivery radius and temperature control", async () => {
      const { user: owner } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();

      const supplier = await prisma.supplier.create({
        data: {
          ownerId: owner.id,
          businessName: "Cold Chain Supplier",
          address: "3 Cold St",
          rating: 4.8,
          zoneId: zone.id,
          maxDeliveryRadius: 25.5,
          temperatureControl: true,
          minOrderValue: 50.0,
        },
      });

      expect(supplier.maxDeliveryRadius).toBe(25.5);
      expect(supplier.temperatureControl).toBe(true);
      expect(supplier.minOrderValue).toBe(50.0);
    });

    it("defaults temperatureControl to false", async () => {
      const { user: owner } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();

      const supplier = await prisma.supplier.create({
        data: {
          ownerId: owner.id,
          businessName: "Basic Supplier",
          address: "4 Normal Rd",
          rating: 3.5,
          zoneId: zone.id,
        },
      });

      expect(supplier.temperatureControl).toBe(false);
      expect(supplier.maxDeliveryRadius).toBeNull();
    });
  });

  describe("min order enforcement", () => {
    it("supplier with minOrderValue is stored correctly", async () => {
      const { user: owner } = await createTestUser(UserRole.SUPPLIER);
      const zone = await createTestZone();

      const supplier = await prisma.supplier.create({
        data: {
          ownerId: owner.id,
          businessName: "Premium Supplier",
          address: "5 Premium Ln",
          rating: 4.5,
          zoneId: zone.id,
          minOrderValue: 100,
        },
      });

      expect(supplier.minOrderValue).toBe(100);
    });
  });

  describe("temperature control checks", () => {
    it("multiple suppliers with different temperature control", async () => {
      const zone = await createTestZone();
      const { user: owner1 } = await createTestUser(UserRole.SUPPLIER);
      const { user: owner2 } = await createTestUser(UserRole.SUPPLIER);

      const coldSupplier = await prisma.supplier.create({
        data: {
          ownerId: owner1.id,
          businessName: "Cold Chain",
          address: "6 Cold Ave",
          rating: 4.0,
          zoneId: zone.id,
          temperatureControl: true,
        },
      });

      const warmSupplier = await prisma.supplier.create({
        data: {
          ownerId: owner2.id,
          businessName: "Ambient Supply",
          address: "7 Warm St",
          rating: 4.2,
          zoneId: zone.id,
          temperatureControl: false,
        },
      });

      const suppliers = await prisma.supplier.findMany({
        where: { zoneId: zone.id, temperatureControl: true },
      });

      expect(suppliers).toHaveLength(1);
      expect(suppliers[0].businessName).toBe("Cold Chain");
    });
  });
});
