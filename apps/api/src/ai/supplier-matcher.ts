import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@dotted/db";
import { SUPPLIER_MATCH_WEIGHTS, AI_MODEL } from "@dotted/shared";
import type { SupplierMatch } from "@dotted/shared";
import { haversineDistance } from "../lib/geo";

const anthropic = new Anthropic();

interface ScoredInventoryItem {
  inventoryId: string;
  supplierId: string;
  supplierName: string;
  ingredientName: string;
  pricePerUnit: number;
  quantityAvailable: number;
  unit: string;
  rating: number;
  isOrganic: boolean;
  score: number;
}

function scoreSupplierItem(
  item: {
    pricePerUnit: number;
    rating: number;
    isOrganic: boolean;
    supplierLat?: number | null;
    supplierLng?: number | null;
  },
  allPrices: number[],
  zoneLat?: number | null,
  zoneLng?: number | null
): number {
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  // Normalize price (lower is better)
  const priceScore = 1 - (item.pricePerUnit - minPrice) / priceRange;
  // Freshness proxy: organic items score higher
  const freshnessScore = item.isOrganic ? 1 : 0.5;
  // Rating normalized to 0-1
  const ratingScore = item.rating / 5;

  // Distance score: use real coordinates when available, fall back to 0.7
  let distanceScore = 0.7;
  if (
    zoneLat != null && zoneLng != null &&
    item.supplierLat != null && item.supplierLng != null
  ) {
    const distKm = haversineDistance(zoneLat, zoneLng, item.supplierLat, item.supplierLng);
    // Normalize: 0km = 1.0, 50km+ = 0.0
    distanceScore = Math.max(0, 1 - distKm / 50);
  }

  return (
    SUPPLIER_MATCH_WEIGHTS.price * priceScore +
    SUPPLIER_MATCH_WEIGHTS.distance * distanceScore +
    SUPPLIER_MATCH_WEIGHTS.freshness * freshnessScore +
    SUPPLIER_MATCH_WEIGHTS.rating * ratingScore
  );
}

export async function optimizeSourcing(cycleId: string): Promise<SupplierMatch[]> {
  const cycle = await prisma.dailyCycle.findUnique({
    where: { id: cycleId },
    include: {
      zone: true,
      dishes: {
        where: { id: undefined }, // will be replaced below
        include: { ingredients: true },
      },
    },
  });

  if (!cycle || !cycle.winningDishId) {
    throw new Error("Cycle not found or no winning dish selected");
  }

  // Get winning dish with ingredients
  const winningDish = await prisma.dish.findUnique({
    where: { id: cycle.winningDishId },
    include: { ingredients: true },
  });

  if (!winningDish) throw new Error("Winning dish not found");

  // Get winning restaurant coordinates for distance calculation
  const winningBid = cycle.winningBidId
    ? await prisma.bid.findUnique({
        where: { id: cycle.winningBidId },
        include: { restaurant: { select: { latitude: true, longitude: true } } },
      })
    : null;
  const refLat = winningBid?.restaurant?.latitude ?? null;
  const refLng = winningBid?.restaurant?.longitude ?? null;

  // Get all available inventory in zone with supplier coordinates
  const inventory = await prisma.supplierInventory.findMany({
    where: {
      supplier: { zoneId: cycle.zoneId },
      quantityAvailable: { gt: 0 },
    },
    include: { supplier: { select: { id: true, businessName: true, rating: true, latitude: true, longitude: true } } },
  });

  const matches: SupplierMatch[] = [];
  const unmatchedIngredients: string[] = [];

  for (const ingredient of winningDish.ingredients) {
    // Find matching inventory items (fuzzy name match)
    const candidates = inventory.filter((item) =>
      item.ingredientName.toLowerCase().includes(ingredient.name.toLowerCase()) ||
      ingredient.name.toLowerCase().includes(item.ingredientName.toLowerCase())
    );

    if (candidates.length === 0) {
      unmatchedIngredients.push(ingredient.name);
      continue;
    }

    // Score each candidate
    const allPrices = candidates.map((c) => c.pricePerUnit);
    const scored: ScoredInventoryItem[] = candidates.map((item) => ({
      inventoryId: item.id,
      supplierId: item.supplier.id,
      supplierName: item.supplier.businessName,
      ingredientName: item.ingredientName,
      pricePerUnit: item.pricePerUnit,
      quantityAvailable: item.quantityAvailable,
      unit: item.unit,
      rating: item.supplier.rating,
      isOrganic: item.isOrganic,
      score: scoreSupplierItem(
        {
          pricePerUnit: item.pricePerUnit,
          rating: item.supplier.rating,
          isOrganic: item.isOrganic,
          supplierLat: item.supplier.latitude,
          supplierLng: item.supplier.longitude,
        },
        allPrices,
        refLat,
        refLng
      ),
    }));

    // Pick the best
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    matches.push({
      ingredientName: ingredient.name,
      supplierId: best.supplierId,
      supplierName: best.supplierName,
      unitPrice: best.pricePerUnit,
      quantity: ingredient.quantity,
      score: best.score,
    });
  }

  // If there are unmatched ingredients, ask Claude for substitution suggestions
  if (unmatchedIngredients.length > 0) {
    const availableItems = inventory.map((i) => `${i.ingredientName} (${i.unit})`).join(", ");
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `I need substitutions for these ingredients that aren't available from local suppliers:
Missing: ${unmatchedIngredients.join(", ")}
Available: ${availableItems}
Dish: ${winningDish.name} — ${winningDish.description}

For each missing ingredient, suggest the best available substitute or indicate if the dish can work without it. Keep it brief.`,
        },
      ],
    });

    // Log substitution suggestions (would be stored/actioned in production)
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      console.log("AI substitution suggestions:", textBlock.text);
    }
  }

  // Create purchase orders grouped by supplier
  const supplierGroups = new Map<string, { supplierId: string; items: { inventoryId: string; quantity: number; unitPrice: number }[]; total: number }>();

  for (const match of matches) {
    const inventoryItem = inventory.find(
      (i) => i.supplier.id === match.supplierId && i.ingredientName.toLowerCase().includes(match.ingredientName.toLowerCase())
    );
    if (!inventoryItem) continue;

    if (!supplierGroups.has(match.supplierId)) {
      supplierGroups.set(match.supplierId, { supplierId: match.supplierId, items: [], total: 0 });
    }
    const group = supplierGroups.get(match.supplierId)!;
    const cost = match.unitPrice * match.quantity;
    group.items.push({ inventoryId: inventoryItem.id, quantity: match.quantity, unitPrice: match.unitPrice });
    group.total += cost;
  }

  // Create purchase orders
  for (const [, group] of supplierGroups) {
    await prisma.purchaseOrder.create({
      data: {
        dailyCycleId: cycleId,
        supplierId: group.supplierId,
        totalCost: group.total,
        items: {
          create: group.items.map((item) => ({
            inventoryItemId: item.inventoryId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });
  }

  return matches;
}
