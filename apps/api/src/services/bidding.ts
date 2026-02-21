import { prisma } from "@dotted/db";
import { BID_SCORE_WEIGHTS, PARTNER_TIERS } from "@dotted/shared";

interface BidScoreInput {
  pricePerPlate: number;
  restaurantRating: number;
  maxCapacity: number;
  prepTime: number;
  requiredCapacity: number;
  partnerTier?: string | null;
}

function computeBidScore(input: BidScoreInput, allBids: BidScoreInput[]): number {
  // Price — lower is better (normalize across all bids)
  const prices = allBids.map((b) => b.pricePerPlate);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const priceScore = 1 - (input.pricePerPlate - minPrice) / priceRange;

  // Rating — higher is better (already 0-5 scale)
  const ratingScore = input.restaurantRating / 5;

  // Capacity — closer to required is better
  const capacityRatio = Math.min(input.maxCapacity / input.requiredCapacity, 1);
  const capacityScore = capacityRatio;

  // Prep time — lower is better
  const prepTimes = allBids.map((b) => b.prepTime);
  const minPrep = Math.min(...prepTimes);
  const maxPrep = Math.max(...prepTimes);
  const prepRange = maxPrep - minPrep || 1;
  const prepScore = 1 - (input.prepTime - minPrep) / prepRange;

  let score =
    BID_SCORE_WEIGHTS.price * priceScore +
    BID_SCORE_WEIGHTS.rating * ratingScore +
    BID_SCORE_WEIGHTS.capacity * capacityScore +
    BID_SCORE_WEIGHTS.prepTime * prepScore;

  // Partner tier priority tiebreaker (small bonus)
  if (input.partnerTier) {
    const tierBonus: Record<string, number> = {
      PLATINUM: 0.04,
      GOLD: 0.03,
      SILVER: 0.02,
      STANDARD: 0,
    };
    score += tierBonus[input.partnerTier] ?? 0;
  }

  return score;
}

export async function scoreBidsAndSelectWinner(cycleId: string): Promise<{
  winnerId: string;
  restaurantName: string;
  score: number;
}> {
  const bids = await prisma.bid.findMany({
    where: { dailyCycleId: cycleId, status: "PENDING" },
    include: { restaurant: true, dish: { select: { equipmentRequired: true } } },
  });

  if (bids.length === 0) {
    throw new Error("No bids submitted for this cycle");
  }

  // Equipment capability check: filter out bids from restaurants lacking required equipment
  const winningDish = bids[0].dish;
  const requiredEquipment = (winningDish.equipmentRequired as string[]) ?? [];

  let eligibleBids = bids;
  if (requiredEquipment.length > 0) {
    eligibleBids = bids.filter((bid) => {
      const restaurantEquipment = (bid.restaurant.equipmentTags as string[]) ?? [];
      const restaurantSet = new Set(restaurantEquipment.map((e) => e.toLowerCase()));
      return requiredEquipment.every((eq) => restaurantSet.has(eq.toLowerCase()));
    });

    // If no restaurant has the equipment, fall back to all bids
    if (eligibleBids.length === 0) {
      eligibleBids = bids;
    }
  }

  // maxConcurrentOrders cap: filter out restaurants at capacity
  const filteredBids = [];
  for (const bid of eligibleBids) {
    if (bid.restaurant.maxConcurrentOrders != null) {
      const activeOrders = await prisma.order.count({
        where: {
          restaurantId: bid.restaurantId,
          status: { in: ["PENDING", "CONFIRMED", "READY"] },
        },
      });
      if (activeOrders >= bid.restaurant.maxConcurrentOrders) continue;
    }
    filteredBids.push(bid);
  }

  const finalBids = filteredBids.length > 0 ? filteredBids : eligibleBids;

  // Estimate required capacity (from zone membership count)
  const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
  const memberCount = await prisma.zoneMembership.count({ where: { zoneId: cycle!.zoneId } });
  const requiredCapacity = Math.ceil(memberCount * 0.3); // assume 30% order rate

  const allBidInputs: BidScoreInput[] = finalBids.map((b) => ({
    pricePerPlate: b.pricePerPlate,
    restaurantRating: b.restaurant.rating,
    maxCapacity: b.maxCapacity,
    prepTime: b.prepTime,
    requiredCapacity,
    partnerTier: b.restaurant.partnerTier,
  }));

  // Score each bid
  const scored = finalBids.map((bid, idx) => ({
    bid,
    score: computeBidScore(allBidInputs[idx], allBidInputs),
  }));

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // Update all original bids with scores and statuses
  await prisma.$transaction(
    bids.map((bid) => {
      const scoredEntry = scored.find((s) => s.bid.id === bid.id);
      return prisma.bid.update({
        where: { id: bid.id },
        data: {
          score: scoredEntry?.score ?? 0,
          status: bid.id === winner.bid.id ? "WON" : "LOST",
        },
      });
    })
  );

  // Update cycle with winning bid
  await prisma.dailyCycle.update({
    where: { id: cycleId },
    data: { winningBidId: winner.bid.id },
  });

  return {
    winnerId: winner.bid.id,
    restaurantName: winner.bid.restaurant.name,
    score: winner.score,
  };
}

export function getCommissionRate(restaurant: {
  commissionRate?: number | null;
  partnerTier?: string | null;
}): number {
  // Restaurant-specific override
  if (restaurant.commissionRate != null) return restaurant.commissionRate;

  // Partner tier rate
  if (restaurant.partnerTier) {
    const tier = PARTNER_TIERS[restaurant.partnerTier as keyof typeof PARTNER_TIERS];
    if (tier) return tier.commissionRate;
  }

  // Default standard rate
  return PARTNER_TIERS.STANDARD.commissionRate;
}
