import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "../../helpers/db";
import { createTestUser } from "../../helpers/auth";
import { createTestZone, createTestCycle, createTestSupplierWithInventory } from "../../helpers/fixtures";
import { createMockAnthropicResponse, createSampleDishSuggestions } from "../../helpers/mocks";

// Module-level mock — required because Anthropic client is instantiated at module scope (line 6)
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Must import AFTER mock is set up
const { generateDishSuggestions } = await import("../../../ai/dish-generator");

describe("Dish Generator AI", () => {
  let zoneId: string;
  let cycleId: string;

  beforeEach(async () => {
    await cleanDatabase();
    mockCreate.mockReset();

    const zone = await createTestZone();
    zoneId = zone.id;
    const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);
    cycleId = cycle.id;
  });

  it("should generate dishes from inventory and save to DB", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    const sampleDishes = createSampleDishSuggestions(4);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    const result = await generateDishSuggestions(zoneId, cycleId);

    expect(result).toHaveLength(4);

    // Verify dishes saved to DB
    const dbDishes = await prisma.dish.findMany({ where: { dailyCycleId: cycleId }, include: { ingredients: true } });
    expect(dbDishes).toHaveLength(4);

    // Each dish should have ingredients
    for (const dish of dbDishes) {
      expect(dish.ingredients.length).toBeGreaterThan(0);
    }
  });

  it("should pass inventory text and past dishes to the prompt", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    const sampleDishes = createSampleDishSuggestions(3);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    await generateDishSuggestions(zoneId, cycleId);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];

    // Should contain inventory info in the user message
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain("Tomatoes");
    expect(userMessage).toContain("Chicken Breast");
    expect(userMessage).toContain("Olive Oil");
  });

  it("should throw when no inventory is available in the zone", async () => {
    await expect(generateDishSuggestions(zoneId, cycleId)).rejects.toThrow(
      "No inventory available in this zone"
    );

    // Should NOT have called Claude
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should throw when AI does not return a tool_use block", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    // Return a text-only response (no tool_use)
    mockCreate.mockResolvedValue({
      id: "msg_test",
      content: [{ type: "text", text: "Here are some dishes..." }],
    });

    await expect(generateDishSuggestions(zoneId, cycleId)).rejects.toThrow(
      "AI did not return structured dish suggestions"
    );
  });

  it("should truncate aiPromptUsed to 500 characters", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    const sampleDishes = createSampleDishSuggestions(3);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    await generateDishSuggestions(zoneId, cycleId);

    const dish = await prisma.dish.findFirst({ where: { dailyCycleId: cycleId } });
    expect(dish!.aiPromptUsed!.length).toBeLessThanOrEqual(500);
  });

  it("should use the correct model and tool config", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    const sampleDishes = createSampleDishSuggestions(3);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    await generateDishSuggestions(zoneId, cycleId);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-20250514");
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe("suggest_dishes");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "suggest_dishes" });
  });

  it("should include past dishes to avoid repetition", async () => {
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);

    // Create a past cycle with a winning dish
    const pastCycle = await createTestCycle(zoneId, CycleStatus.COMPLETED, {
      date: new Date(Date.now() - 86400000),
    });
    const pastDish = await prisma.dish.create({
      data: {
        dailyCycleId: pastCycle.id,
        name: "Previous Winner Pasta",
        description: "A past dish",
        cuisine: "Italian",
        estimatedCost: 10,
        voteCount: 5,
      },
    });
    await prisma.dailyCycle.update({
      where: { id: pastCycle.id },
      data: { winningDishId: pastDish.id },
    });

    const sampleDishes = createSampleDishSuggestions(3);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    await generateDishSuggestions(zoneId, cycleId);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain("Previous Winner Pasta");
  });
});
