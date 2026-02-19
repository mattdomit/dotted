import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@dotted/db";
import { AI_MODEL, AI_MAX_TOKENS } from "@dotted/shared";
import type { DishSuggestion } from "@dotted/shared";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Dotted Chef AI — an expert culinary advisor for a hyperlocal community food marketplace.

Your role: Given a list of available ingredients from local suppliers, suggest 3-5 creative, delicious dishes that can be prepared by local restaurants for the community's "Dish of the Day".

Rules:
- Only use ingredients that are available in the provided inventory
- Consider seasonal appropriateness and ingredient freshness
- Estimate realistic per-plate costs based on ingredient prices
- Suggest a variety of cuisines and cooking styles
- Include clear recipe specifications with prep/cook times
- Be creative but practical — these dishes need to be prepared in bulk by a restaurant

You MUST respond using the provided tool to return structured dish suggestions.`;

const DISH_TOOL: Anthropic.Tool = {
  name: "suggest_dishes",
  description: "Return structured dish suggestions based on available inventory",
  input_schema: {
    type: "object" as const,
    properties: {
      dishes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the dish" },
            description: { type: "string", description: "Appetizing 2-3 sentence description" },
            cuisine: { type: "string", description: "Cuisine type (e.g., Italian, Mexican, Asian Fusion)" },
            estimatedCost: { type: "number", description: "Estimated cost per plate in USD" },
            tags: { type: "array", items: { type: "string" }, description: "Tags like vegetarian, gluten-free, spicy" },
            recipeSpec: {
              type: "object",
              properties: {
                servings: { type: "number" },
                prepTime: { type: "number", description: "Prep time in minutes" },
                cookTime: { type: "number", description: "Cook time in minutes" },
                instructions: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["servings", "prepTime", "cookTime", "instructions", "tags"],
            },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  category: { type: "string" },
                  substitutes: { type: "array", items: { type: "string" } },
                },
                required: ["name", "quantity", "unit", "category", "substitutes"],
              },
            },
          },
          required: ["name", "description", "cuisine", "estimatedCost", "tags", "recipeSpec", "ingredients"],
        },
        minItems: 3,
        maxItems: 5,
      },
    },
    required: ["dishes"],
  },
};

export async function generateDishSuggestions(zoneId: string, cycleId: string): Promise<DishSuggestion[]> {
  // Fetch available inventory in the zone
  const inventory = await prisma.supplierInventory.findMany({
    where: {
      supplier: { zoneId },
      quantityAvailable: { gt: 0 },
    },
    include: { supplier: { select: { businessName: true } } },
  });

  if (inventory.length === 0) {
    throw new Error("No inventory available in this zone");
  }

  // Fetch past winning dishes to avoid repetition
  const pastDishes = await prisma.dish.findMany({
    where: {
      dailyCycle: { zoneId, winningDishId: { not: null } },
    },
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { name: true, cuisine: true },
  });

  const inventoryText = inventory
    .map((item) => `- ${item.ingredientName} (${item.category}): ${item.quantityAvailable} ${item.unit} @ $${item.pricePerUnit}/${item.unit} [${item.supplier.businessName}]${item.isOrganic ? " [ORGANIC]" : ""}`)
    .join("\n");

  const pastDishesText = pastDishes.length > 0
    ? `\nRecent winning dishes (avoid repetition):\n${pastDishes.map((d) => `- ${d.name} (${d.cuisine})`).join("\n")}`
    : "";

  const userMessage = `Here is the available inventory from local suppliers in this zone:

${inventoryText}
${pastDishesText}

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

Please suggest 3-5 creative dishes that restaurants could prepare as today's "Dish of the Day" using these available ingredients.`;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [DISH_TOOL],
    tool_choice: { type: "tool", name: "suggest_dishes" },
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract tool use response
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return structured dish suggestions");
  }

  const { dishes } = toolUse.input as { dishes: DishSuggestion[] };

  // Save dishes to database
  for (const dish of dishes) {
    await prisma.dish.create({
      data: {
        dailyCycleId: cycleId,
        name: dish.name,
        description: dish.description,
        cuisine: dish.cuisine,
        estimatedCost: dish.estimatedCost,
        recipeSpec: dish.recipeSpec as any,
        voteCount: 0,
        aiPromptUsed: userMessage.substring(0, 500),
        ingredients: {
          create: dish.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category,
            substitutes: ing.substitutes,
          })),
        },
      },
    });
  }

  return dishes;
}
