import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@dotted/db";
import { AI_MODEL, AI_MAX_TOKENS, SEASONAL_INGREDIENTS, DEFAULT_OPTIMIZATION_WEIGHTS } from "@dotted/shared";
import type { DishSuggestion } from "@dotted/shared";
import { computeDishOptimizationScores, getZoneWeights } from "../services/optimization";

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
- Respect dietary restrictions and preferences of the community
- Stay within the budget ceiling if one is provided
- Prioritize preferred cuisines when specified
- Consider equipment availability in the zone's restaurants
- Include equipment requirements for each dish

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
            equipmentRequired: { type: "array", items: { type: "string" }, description: "Required equipment like oven, grill, fryer, wok, tandoor" },
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
          required: ["name", "description", "cuisine", "estimatedCost", "tags", "equipmentRequired", "recipeSpec", "ingredients"],
        },
        minItems: 3,
        maxItems: 5,
      },
    },
    required: ["dishes"],
  },
};

export async function generateDishSuggestions(zoneId: string, cycleId: string): Promise<DishSuggestion[]> {
  // Fetch zone config
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: {
      maxPricePerPlate: true,
      preferredCuisines: true,
      optWeightQuality: true,
      optWeightFreshness: true,
      optWeightVariety: true,
      optWeightCost: true,
      optWeightWaste: true,
    },
  });

  // Fetch available inventory in the zone (cap at 50 items)
  const inventory = await prisma.supplierInventory.findMany({
    where: {
      supplier: { zoneId },
      quantityAvailable: { gt: 0 },
    },
    include: { supplier: { select: { businessName: true } } },
    take: 50,
  });

  if (inventory.length === 0) {
    throw new Error("No inventory available in this zone");
  }

  // Fetch past winning dishes to avoid repetition (cap at 14)
  const pastDishes = await prisma.dish.findMany({
    where: {
      dailyCycle: { zoneId, winningDishId: { not: null } },
    },
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { name: true, cuisine: true },
  });

  // Aggregate dietary preferences from zone members
  const members = await prisma.zoneMembership.findMany({
    where: { zoneId },
    include: { user: { select: { dietaryPreferences: true } } },
  });
  const dietaryCounts: Record<string, number> = {};
  for (const m of members) {
    const prefs = m.user.dietaryPreferences as string[];
    if (Array.isArray(prefs)) {
      for (const pref of prefs) {
        dietaryCounts[pref] = (dietaryCounts[pref] || 0) + 1;
      }
    }
  }

  // Fetch historical review ratings by cuisine for this zone
  const reviewStats = await prisma.review.groupBy({
    by: ["restaurantId"],
    where: {
      restaurant: { zoneId },
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  // Get available equipment from zone restaurants
  const restaurants = await prisma.restaurant.findMany({
    where: { zoneId },
    select: { equipmentTags: true },
  });
  const zoneEquipment = new Set<string>();
  for (const r of restaurants) {
    const tags = r.equipmentTags as string[];
    if (Array.isArray(tags)) {
      for (const tag of tags) zoneEquipment.add(tag.toLowerCase());
    }
  }

  // Get seasonal ingredients for current month
  const currentMonth = new Date().getMonth();
  const seasonalItems = SEASONAL_INGREDIENTS[currentMonth] || [];

  // Get optimization weights context
  const weights = zone ? getZoneWeights(zone) : DEFAULT_OPTIMIZATION_WEIGHTS;

  // Build enhanced prompt
  const inventoryText = inventory
    .map((item) => `- ${item.ingredientName} (${item.category}): ${item.quantityAvailable} ${item.unit} @ $${item.pricePerUnit}/${item.unit} [${item.supplier.businessName}]${item.isOrganic ? " [ORGANIC]" : ""}`)
    .join("\n");

  const pastDishesText = pastDishes.length > 0
    ? `\nRecent winning dishes (avoid repetition):\n${pastDishes.map((d) => `- ${d.name} (${d.cuisine})`).join("\n")}`
    : "";

  const budgetText = zone?.maxPricePerPlate
    ? `\nBudget ceiling: $${zone.maxPricePerPlate} per plate maximum. All dishes MUST be at or below this price.`
    : "";

  const preferredCuisines = zone?.preferredCuisines as string[] | undefined;
  const cuisineText = preferredCuisines && preferredCuisines.length > 0
    ? `\nPreferred cuisines (prioritize these): ${preferredCuisines.join(", ")}`
    : "";

  const dietaryText = Object.keys(dietaryCounts).length > 0
    ? `\nCommunity dietary needs (number of members):\n${Object.entries(dietaryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([pref, count]) => `- ${pref}: ${count} members`)
        .join("\n")}\nTry to include at least one dish that accommodates the most common restrictions.`
    : "";

  const seasonalText = seasonalItems.length > 0
    ? `\nSeasonal ingredients this month: ${seasonalItems.join(", ")}. Prefer these when available in inventory.`
    : "";

  const equipmentText = zoneEquipment.size > 0
    ? `\nAvailable equipment in zone restaurants: ${[...zoneEquipment].join(", ")}. Only suggest dishes that can be made with this equipment.`
    : "";

  const weightsText = `\nOptimization priorities: Quality=${weights.quality}, Freshness=${weights.freshness}, Variety=${weights.variety}, Cost=${weights.cost}, Waste=${weights.waste}. Prioritize accordingly.`;

  const userMessage = `Here is the available inventory from local suppliers in this zone:

${inventoryText}
${pastDishesText}
${budgetText}
${cuisineText}
${dietaryText}
${seasonalText}
${equipmentText}
${weightsText}

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

  let { dishes } = toolUse.input as { dishes: (DishSuggestion & { equipmentRequired?: string[] })[] };

  // Post-generation filter: discard dishes above maxPricePerPlate
  if (zone?.maxPricePerPlate) {
    dishes = dishes.filter((d) => d.estimatedCost <= zone.maxPricePerPlate!);
  }

  // Equipment filtering: exclude dishes needing equipment no zone restaurant has
  if (zoneEquipment.size > 0) {
    dishes = dishes.filter((d) => {
      const required = d.equipmentRequired ?? [];
      return required.every((eq) => zoneEquipment.has(eq.toLowerCase()));
    });
  }

  if (dishes.length === 0) {
    throw new Error("No dishes within budget/equipment constraints after filtering");
  }

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
        equipmentRequired: dish.equipmentRequired ?? [],
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

  // Compute and store optimization scores
  await computeDishOptimizationScores(cycleId, zoneId);

  return dishes;
}
