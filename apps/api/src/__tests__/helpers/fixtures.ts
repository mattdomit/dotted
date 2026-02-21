import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createTestUser } from "./auth";

let fixtureCounter = 0;

function inc() {
  return ++fixtureCounter;
}

export async function createTestZone(overrides: Partial<{ name: string; slug: string; city: string; state: string; maxPricePerPlate: number; preferredCuisines: string[] }> = {}) {
  const n = inc();
  return prisma.zone.create({
    data: {
      name: overrides.name ?? `Test Zone ${n}`,
      slug: overrides.slug ?? `test-zone-${n}-${Date.now()}`,
      city: overrides.city ?? "Test City",
      state: overrides.state ?? "TC",
      maxPricePerPlate: overrides.maxPricePerPlate,
      preferredCuisines: overrides.preferredCuisines ?? [],
    },
  });
}

export async function createTestCycle(
  zoneId: string,
  status: CycleStatus = CycleStatus.SUGGESTING,
  overrides: Partial<{ date: Date; winningDishId: string; winningBidId: string }> = {}
) {
  const date = overrides.date ?? new Date();
  date.setHours(0, 0, 0, 0);

  return prisma.dailyCycle.create({
    data: {
      zoneId,
      date,
      status,
      winningDishId: overrides.winningDishId,
      winningBidId: overrides.winningBidId,
    },
  });
}

export async function createTestDishes(cycleId: string, count: number = 4) {
  const dishes = [];
  for (let i = 0; i < count; i++) {
    const n = inc();
    const dish = await prisma.dish.create({
      data: {
        dailyCycleId: cycleId,
        name: `Test Dish ${n}`,
        description: `A delicious test dish number ${n}`,
        cuisine: ["Italian", "Mexican", "Asian", "American"][i % 4],
        estimatedCost: 10 + i * 2,
        voteCount: 0,
        recipeSpec: { servings: 4, prepTime: 15, cookTime: 30, instructions: ["Step 1"], tags: ["test"] },
        ingredients: {
          create: [
            { name: `Ingredient ${n}A`, quantity: 2, unit: "kg", category: "Produce", substitutes: [] },
            { name: `Ingredient ${n}B`, quantity: 1, unit: "lbs", category: "Protein", substitutes: [] },
          ],
        },
      },
      include: { ingredients: true },
    });
    dishes.push(dish);
  }
  return dishes;
}

export async function createTestRestaurant(ownerId: string, zoneId: string, overrides: Partial<{ name: string; rating: number; capacity: number }> = {}) {
  const n = inc();
  return prisma.restaurant.create({
    data: {
      ownerId,
      name: overrides.name ?? `Test Restaurant ${n}`,
      address: `${n} Test St`,
      rating: overrides.rating ?? 4.0,
      capacity: overrides.capacity ?? 100,
      zoneId,
    },
  });
}

export async function createTestSupplierWithInventory(ownerId: string, zoneId: string) {
  const n = inc();
  const supplier = await prisma.supplier.create({
    data: {
      ownerId,
      businessName: `Test Supplier ${n}`,
      address: `${n} Supplier Rd`,
      rating: 4.5,
      zoneId,
    },
  });

  const items = await prisma.$transaction([
    prisma.supplierInventory.create({
      data: {
        supplierId: supplier.id,
        ingredientName: "Tomatoes",
        category: "Produce",
        unit: "kg",
        pricePerUnit: 3.5,
        quantityAvailable: 100,
        isOrganic: true,
      },
    }),
    prisma.supplierInventory.create({
      data: {
        supplierId: supplier.id,
        ingredientName: "Chicken Breast",
        category: "Protein",
        unit: "kg",
        pricePerUnit: 8.0,
        quantityAvailable: 50,
        isOrganic: false,
      },
    }),
    prisma.supplierInventory.create({
      data: {
        supplierId: supplier.id,
        ingredientName: "Olive Oil",
        category: "Pantry",
        unit: "liters",
        pricePerUnit: 12.0,
        quantityAvailable: 20,
        isOrganic: true,
      },
    }),
  ]);

  return { supplier, inventory: items };
}

export async function createTestBid(
  restaurantId: string,
  dailyCycleId: string,
  dishId: string,
  overrides: Partial<{ pricePerPlate: number; prepTime: number; maxCapacity: number }> = {}
) {
  return prisma.bid.create({
    data: {
      restaurantId,
      dailyCycleId,
      dishId,
      pricePerPlate: overrides.pricePerPlate ?? 15,
      prepTime: overrides.prepTime ?? 30,
      maxCapacity: overrides.maxCapacity ?? 100,
      serviceFeeAccepted: true,
    },
  });
}

export async function createTestReviewReply(reviewId: string, userId: string, body: string = "Test reply") {
  return prisma.reviewReply.create({
    data: { reviewId, userId, body },
  });
}

export async function createTestZonePost(zoneId: string, userId: string, body: string = "Test post") {
  return prisma.zonePost.create({
    data: { zoneId, userId, body },
  });
}

export async function createTestVerificationCode(
  userId: string,
  type: "EMAIL" | "SMS" = "EMAIL",
  overrides: Partial<{ code: string; expiresAt: Date }> = {}
) {
  return prisma.verificationCode.create({
    data: {
      userId,
      code: overrides.code ?? "123456",
      type,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
    },
  });
}
