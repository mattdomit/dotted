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
        equipmentRequired: [],
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

export async function createTestRestaurant(ownerId: string, zoneId: string, overrides: Partial<{ name: string; rating: number; capacity: number; equipmentTags: string[]; maxConcurrentOrders: number; partnerTier: string; commissionRate: number }> = {}) {
  const n = inc();
  return prisma.restaurant.create({
    data: {
      ownerId,
      name: overrides.name ?? `Test Restaurant ${n}`,
      address: `${n} Test St`,
      rating: overrides.rating ?? 4.0,
      capacity: overrides.capacity ?? 100,
      zoneId,
      equipmentTags: overrides.equipmentTags ?? [],
      maxConcurrentOrders: overrides.maxConcurrentOrders,
      partnerTier: overrides.partnerTier,
      commissionRate: overrides.commissionRate,
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

// --- v2.0 Fixtures ---

export async function createTestSubscription(
  userId: string,
  tier: "PLUS" | "PREMIUM" = "PLUS"
) {
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: tier },
  });
  return prisma.subscription.create({
    data: {
      userId,
      tier,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function createTestQualityScore(
  orderId: string,
  userId: string,
  restaurantId: string,
  dailyCycleId: string,
  overrides: Partial<{ taste: number; freshness: number; presentation: number; portion: number }> = {}
) {
  const taste = overrides.taste ?? 4;
  const freshness = overrides.freshness ?? 4;
  const presentation = overrides.presentation ?? 4;
  const portion = overrides.portion ?? 4;
  const overall = (taste + freshness + presentation + portion) / 4;

  return prisma.qualityScore.create({
    data: { orderId, userId, restaurantId, dailyCycleId, taste, freshness, presentation, portion, overall },
  });
}

export async function createTestAchievement(userId: string, badge: string) {
  return prisma.achievement.create({
    data: { userId, badge },
  });
}

export async function createTestPreferenceSignal(
  userId: string,
  overrides: Partial<{ signalType: string; dishName: string; cuisine: string; tags: string[] }> = {}
) {
  return prisma.userPreferenceSignal.create({
    data: {
      userId,
      signalType: overrides.signalType ?? "VOTE",
      dishName: overrides.dishName,
      cuisine: overrides.cuisine,
      tags: overrides.tags ?? [],
    },
  });
}
