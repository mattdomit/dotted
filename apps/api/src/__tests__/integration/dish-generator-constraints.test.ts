import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "../helpers/db";
import { createTestUser } from "../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../helpers/fixtures";

// Mock Anthropic SDK
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { generateDishSuggestions } from "../../ai/dish-generator";

function createDishResponse(dishes: any[]) {
  return {
    content: [
      {
        type: "tool_use",
        id: "test",
        name: "suggest_dishes",
        input: { dishes },
      },
    ],
  };
}

describe("Dish Generator Constraints", () => {
  let zoneId: string;
  let cycleId: string;

  beforeEach(async () => {
    await cleanDatabase();
    mockCreate.mockReset();
  });

  async function setupZoneWithInventory(overrides: { maxPricePerPlate?: number; preferredCuisines?: string[] } = {}) {
    const zone = await createTestZone({
      maxPricePerPlate: overrides.maxPricePerPlate,
      preferredCuisines: overrides.preferredCuisines,
    });
    zoneId = zone.id;

    const { user: supplierUser } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierUser.id, zone.id);

    const cycle = await createTestCycle(zone.id, CycleStatus.SUGGESTING);
    cycleId = cycle.id;

    return { zone, cycle };
  }

  it("budget ceiling filters out expensive dishes", async () => {
    await setupZoneWithInventory({ maxPricePerPlate: 12 });

    mockCreate.mockResolvedValueOnce(
      createDishResponse([
        {
          name: "Cheap Salad",
          description: "A fresh salad",
          cuisine: "American",
          estimatedCost: 8,
          tags: ["healthy"],
          recipeSpec: { servings: 4, prepTime: 10, cookTime: 0, instructions: ["Toss"], tags: ["quick"] },
          ingredients: [{ name: "Tomatoes", quantity: 2, unit: "kg", category: "Produce", substitutes: [] }],
        },
        {
          name: "Expensive Steak",
          description: "A premium steak",
          cuisine: "American",
          estimatedCost: 25,
          tags: ["premium"],
          recipeSpec: { servings: 4, prepTime: 15, cookTime: 30, instructions: ["Grill"], tags: ["dinner"] },
          ingredients: [{ name: "Beef", quantity: 1, unit: "kg", category: "Protein", substitutes: [] }],
        },
        {
          name: "Budget Pasta",
          description: "A simple pasta",
          cuisine: "Italian",
          estimatedCost: 10,
          tags: ["comfort"],
          recipeSpec: { servings: 4, prepTime: 10, cookTime: 20, instructions: ["Boil", "Mix"], tags: ["easy"] },
          ingredients: [{ name: "Olive Oil", quantity: 0.5, unit: "liters", category: "Pantry", substitutes: [] }],
        },
      ])
    );

    const dishes = await generateDishSuggestions(zoneId, cycleId);

    // Expensive Steak ($25) should be filtered out
    expect(dishes).toHaveLength(2);
    expect(dishes.every((d) => d.estimatedCost <= 12)).toBe(true);
    expect(dishes.map((d) => d.name)).not.toContain("Expensive Steak");
  });

  it("dietary preferences are included in prompt", async () => {
    const zone = await createTestZone();
    zoneId = zone.id;

    const { user: supplierUser } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierUser.id, zone.id);

    // Create consumers with dietary preferences and join zone
    const { user: consumer1 } = await createTestUser(UserRole.CONSUMER);
    await prisma.user.update({ where: { id: consumer1.id }, data: { dietaryPreferences: ["Vegetarian", "Gluten-Free"] } });
    await prisma.zoneMembership.create({ data: { userId: consumer1.id, zoneId: zone.id } });

    const { user: consumer2 } = await createTestUser(UserRole.CONSUMER);
    await prisma.user.update({ where: { id: consumer2.id }, data: { dietaryPreferences: ["Vegetarian"] } });
    await prisma.zoneMembership.create({ data: { userId: consumer2.id, zoneId: zone.id } });

    const cycle = await createTestCycle(zone.id, CycleStatus.SUGGESTING);
    cycleId = cycle.id;

    mockCreate.mockResolvedValueOnce(
      createDishResponse([
        {
          name: "Veggie Bowl",
          description: "A vegetarian bowl",
          cuisine: "Asian",
          estimatedCost: 10,
          tags: ["vegetarian"],
          recipeSpec: { servings: 4, prepTime: 10, cookTime: 15, instructions: ["Cook"], tags: ["healthy"] },
          ingredients: [{ name: "Tomatoes", quantity: 1, unit: "kg", category: "Produce", substitutes: [] }],
        },
        {
          name: "Pasta Primavera",
          description: "Fresh pasta",
          cuisine: "Italian",
          estimatedCost: 12,
          tags: ["vegetarian"],
          recipeSpec: { servings: 4, prepTime: 15, cookTime: 20, instructions: ["Boil", "Mix"], tags: ["comfort"] },
          ingredients: [{ name: "Olive Oil", quantity: 0.3, unit: "liters", category: "Pantry", substitutes: [] }],
        },
        {
          name: "Garden Salad",
          description: "Fresh salad",
          cuisine: "American",
          estimatedCost: 8,
          tags: ["gluten-free"],
          recipeSpec: { servings: 4, prepTime: 5, cookTime: 0, instructions: ["Toss"], tags: ["quick"] },
          ingredients: [{ name: "Tomatoes", quantity: 0.5, unit: "kg", category: "Produce", substitutes: [] }],
        },
      ])
    );

    await generateDishSuggestions(zoneId, cycleId);

    // Verify the prompt included dietary preferences
    const call = mockCreate.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain("Vegetarian");
    expect(userMessage).toContain("2 members"); // 2 vegetarians
    expect(userMessage).toContain("Gluten-Free");
    expect(userMessage).toContain("1 members"); // 1 gluten-free
  });

  it("seasonal data is included in prompt", async () => {
    await setupZoneWithInventory();

    mockCreate.mockResolvedValueOnce(
      createDishResponse([
        {
          name: "Seasonal Dish",
          description: "A seasonal dish",
          cuisine: "American",
          estimatedCost: 10,
          tags: ["seasonal"],
          recipeSpec: { servings: 4, prepTime: 10, cookTime: 20, instructions: ["Cook"], tags: ["test"] },
          ingredients: [{ name: "Tomatoes", quantity: 1, unit: "kg", category: "Produce", substitutes: [] }],
        },
        {
          name: "Basic Dish",
          description: "A basic dish",
          cuisine: "Italian",
          estimatedCost: 8,
          tags: [],
          recipeSpec: { servings: 4, prepTime: 5, cookTime: 10, instructions: ["Mix"], tags: ["easy"] },
          ingredients: [{ name: "Olive Oil", quantity: 0.2, unit: "liters", category: "Pantry", substitutes: [] }],
        },
        {
          name: "Third Dish",
          description: "Another dish",
          cuisine: "Mexican",
          estimatedCost: 9,
          tags: [],
          recipeSpec: { servings: 4, prepTime: 8, cookTime: 12, instructions: ["Cook"], tags: ["test"] },
          ingredients: [{ name: "Chicken Breast", quantity: 1, unit: "kg", category: "Protein", substitutes: [] }],
        },
      ])
    );

    await generateDishSuggestions(zoneId, cycleId);

    const call = mockCreate.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain("Seasonal ingredients this month");
  });

  it("preferred cuisines are included in prompt", async () => {
    await setupZoneWithInventory({ preferredCuisines: ["Italian", "Mexican"] });

    mockCreate.mockResolvedValueOnce(
      createDishResponse([
        {
          name: "Pasta",
          description: "Fresh pasta",
          cuisine: "Italian",
          estimatedCost: 10,
          tags: [],
          recipeSpec: { servings: 4, prepTime: 10, cookTime: 20, instructions: ["Cook"], tags: ["test"] },
          ingredients: [{ name: "Olive Oil", quantity: 0.2, unit: "liters", category: "Pantry", substitutes: [] }],
        },
        {
          name: "Tacos",
          description: "Fresh tacos",
          cuisine: "Mexican",
          estimatedCost: 9,
          tags: [],
          recipeSpec: { servings: 4, prepTime: 15, cookTime: 10, instructions: ["Cook"], tags: ["test"] },
          ingredients: [{ name: "Chicken Breast", quantity: 1, unit: "kg", category: "Protein", substitutes: [] }],
        },
        {
          name: "Salad",
          description: "Fresh salad",
          cuisine: "American",
          estimatedCost: 7,
          tags: [],
          recipeSpec: { servings: 4, prepTime: 5, cookTime: 0, instructions: ["Toss"], tags: ["test"] },
          ingredients: [{ name: "Tomatoes", quantity: 0.5, unit: "kg", category: "Produce", substitutes: [] }],
        },
      ])
    );

    await generateDishSuggestions(zoneId, cycleId);

    const call = mockCreate.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain("Preferred cuisines");
    expect(userMessage).toContain("Italian");
    expect(userMessage).toContain("Mexican");
  });
});
