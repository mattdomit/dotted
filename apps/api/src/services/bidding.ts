import { prisma } from "@dotted/db";
import { BID_SCORE_WEIGHTS } from "@dotted/shared";

interface BidScoreInput {
  pricePerPlate: number;
  restaurantRating: number;
  maxCapacity: number;
  prepTime: number;
  requiredCapacity: number;
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

  return (
    BID_SCORE_WEIGHTS.price * priceScore +
    BID_SCORE_WEIGHTS.rating * ratingScore +
    BID_SCORE_WEIGHTS.capacity * capacityScore +
    BID_SCORE_WEIGHTS.prepTime * prepScore
  );
}

export async function scoreBidsAndSelectWinner(cycleId: string): Promise<{
  winnerId: string;
  restaurantName: string;
  score: number;
}> {
  const bids = await prisma.bid.findMany({
    where: { dailyCycleId: cycleId, status: "PENDING" },
    include: { restaurant: true },
  });

  if (bids.length === 0) {
    throw new Error("No bids submitted for this cycle");
  }

  // Estimate required capacity (from zone membership count)
  const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
  const memberCount = await prisma.zoneMembership.count({ where: { zoneId: cycle!.zoneId } });
  const requiredCapacity = Math.ceil(memberCount * 0.3); // assume 30% order rate

  const allBidInputs: BidScoreInput[] = bids.map((b) => ({
    pricePerPlate: b.pricePerPlate,
    restaurantRating: b.restaurant.rating,
    maxCapacity: b.maxCapacity,
    prepTime: b.prepTime,
    requiredCapacity,
  }));

  // Score each bid
  const scored = bids.map((bid, idx) => ({
    bid,
    score: computeBidScore(allBidInputs[idx], allBidInputs),
  }));

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // Update all bids with scores and statuses
  await prisma.$transaction(
    scored.map(({ bid, score }, idx) =>
      prisma.bid.update({
        where: { id: bid.id },
        data: {
          score,
          status: idx === 0 ? "WON" : "LOST",
        },
      })
    )
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
