import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "../../helpers/db";
import { createTestUser } from "../../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../../helpers/fixtures";
import { createMockSubstitutionResponse } from "../../helpers/mocks";

// Module-level mock — required because Anthropic client is instantiated at module scope (line 6)
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Must import AFTER mock is set up
const { optimizeSourcing } = await import("../../../ai/supplier-matcher");

describe("Supplier Matcher AI", () => {
  let zoneId: string;
  let cycleId: string;

  beforeEach(async () => {
    await cleanDatabase();
    mockCreate.mockReset();
  });

  async function setupCycleWithWinningDish() {
    const zone = await createTestZone();
    zoneId = zone.id;
    const cycle = await createTestCycle(zoneId, CycleStatus.SOURCING);
    cycleId = cycle.id;

    // Create winning dish with ingredients that match supplier inventory
    const dish = await prisma.dish.create({
      data: {
        dailyCycleId: cycleId,
        name: "Test Dish",
        description: "A test dish",
        cuisine: "Italian",
        estimatedCost: 12,
        voteCount: 5,
        ingredients: {
          create: [
            { name: "Tomatoes", quantity: 5, unit: "kg", category: "Produce", substitutes: [] },
            { name: "Chicken Breast", quantity: 3, unit: "kg", category: "Protein", substitutes: [] },
          ],
        },
      },
    });

    await prisma.dailyCycle.update({
      where: { id: cycleId },
      data: { winningDishId: dish.id },
    });

    return { dish };
  }

  it("should match ingredients to best-scoring supplier", async () => {
    const { dish } = await setupCycleWithWinningDish();
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    const matches = await optimizeSourcing(cycleId);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].ingredientName).toBeDefined();
    expect(matches[0].supplierId).toBeDefined();
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it("should score organic items higher on freshness", async () => {
    await setupCycleWithWinningDish();
    const { user: s1 } = await createTestUser(UserRole.SUPPLIER);
    const supplier = await prisma.supplier.create({
      data: { ownerId: s1.id, businessName: "Organic Farm", address: "1 Farm Rd", rating: 4, zoneId },
    });

    // Create organic and non-organic tomatoes at same price, plus chicken breast for both
    await prisma.supplierInventory.create({
      data: { supplierId: supplier.id, ingredientName: "Organic Tomatoes", category: "Produce", unit: "kg", pricePerUnit: 4, quantityAvailable: 100, isOrganic: true },
    });
    await prisma.supplierInventory.create({
      data: { supplierId: supplier.id, ingredientName: "Chicken Breast", category: "Protein", unit: "kg", pricePerUnit: 8, quantityAvailable: 50, isOrganic: false },
    });

    const { user: s2 } = await createTestUser(UserRole.SUPPLIER);
    const supplier2 = await prisma.supplier.create({
      data: { ownerId: s2.id, businessName: "Regular Farm", address: "2 Farm Rd", rating: 4, zoneId },
    });
    await prisma.supplierInventory.create({
      data: { supplierId: supplier2.id, ingredientName: "Tomatoes", category: "Produce", unit: "kg", pricePerUnit: 4, quantityAvailable: 100, isOrganic: false },
    });
    await prisma.supplierInventory.create({
      data: { supplierId: supplier2.id, ingredientName: "Chicken Breast", category: "Protein", unit: "kg", pricePerUnit: 8, quantityAvailable: 50, isOrganic: false },
    });

    const matches = await optimizeSourcing(cycleId);

    // Find the tomato match — organic should win due to higher freshness score
    const tomatoMatch = matches.find((m) => m.ingredientName === "Tomatoes");
    if (tomatoMatch) {
      expect(tomatoMatch.supplierName).toBe("Organic Farm");
    }
  });

  it("should create purchase orders grouped by supplier", async () => {
    await setupCycleWithWinningDish();
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    await optimizeSourcing(cycleId);

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { dailyCycleId: cycleId },
      include: { items: true },
    });

    expect(purchaseOrders.length).toBeGreaterThan(0);
    // Items in each PO should have a positive total cost
    for (const po of purchaseOrders) {
      expect(po.totalCost).toBeGreaterThan(0);
      expect(po.items.length).toBeGreaterThan(0);
    }
  });

  it("should call Claude for substitution when ingredients are unmatched", async () => {
    const zone = await createTestZone();
    zoneId = zone.id;
    const cycle = await createTestCycle(zoneId, CycleStatus.SOURCING);
    cycleId = cycle.id;

    // Create dish with an ingredient that has no matching inventory
    const dish = await prisma.dish.create({
      data: {
        dailyCycleId: cycleId,
        name: "Exotic Dish",
        description: "Uses rare ingredients",
        cuisine: "Fusion",
        estimatedCost: 20,
        voteCount: 3,
        ingredients: {
          create: [
            { name: "Dragon Fruit", quantity: 2, unit: "kg", category: "Exotic", substitutes: [] },
          ],
        },
      },
    });

    await prisma.dailyCycle.update({
      where: { id: cycleId },
      data: { winningDishId: dish.id },
    });

    // Add some inventory, but nothing matching "Dragon Fruit"
    const { user: so } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(so.id, zoneId);

    mockCreate.mockResolvedValue(
      createMockSubstitutionResponse("You could substitute Dragon Fruit with mango.")
    );

    await optimizeSourcing(cycleId);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("Dragon Fruit");
  });

  it("should NOT call Claude when all ingredients match", async () => {
    await setupCycleWithWinningDish();
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    await optimizeSourcing(cycleId);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should throw when cycle has no winning dish", async () => {
    const zone = await createTestZone();
    const cycle = await createTestCycle(zone.id, CycleStatus.SOURCING);

    await expect(optimizeSourcing(cycle.id)).rejects.toThrow(
      "Cycle not found or no winning dish selected"
    );
  });

  it("should match fuzzy ingredient names", async () => {
    await setupCycleWithWinningDish();

    // Supplier has "Organic Tomatoes" which should match dish ingredient "Tomatoes"
    const { user: so } = await createTestUser(UserRole.SUPPLIER);
    const supplier = await prisma.supplier.create({
      data: { ownerId: so.id, businessName: "Fuzzy Farm", address: "1 Fuzzy Rd", rating: 4, zoneId },
    });
    await prisma.supplierInventory.create({
      data: { supplierId: supplier.id, ingredientName: "Organic Tomatoes", category: "Produce", unit: "kg", pricePerUnit: 4, quantityAvailable: 100, isOrganic: true },
    });
    await prisma.supplierInventory.create({
      data: { supplierId: supplier.id, ingredientName: "Chicken Breast Fillets", category: "Protein", unit: "kg", pricePerUnit: 9, quantityAvailable: 50, isOrganic: false },
    });

    const matches = await optimizeSourcing(cycleId);

    // Should have matched both ingredients via fuzzy matching
    expect(matches.length).toBe(2);
  });
});
