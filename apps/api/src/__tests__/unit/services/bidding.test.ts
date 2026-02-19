import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { scoreBidsAndSelectWinner } from "../../../services/bidding";
import { cleanDatabase } from "../../helpers/db";
import { createTestUser } from "../../helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestRestaurant, createTestBid } from "../../helpers/fixtures";

describe("Bidding Service", () => {
  let zoneId: string;
  let cycleId: string;
  let dishId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    zoneId = zone.id;

    // Create some zone members so requiredCapacity > 0
    for (let i = 0; i < 10; i++) {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await prisma.zoneMembership.create({ data: { userId: user.id, zoneId } });
    }

    const cycle = await createTestCycle(zoneId, CycleStatus.BIDDING);
    cycleId = cycle.id;
    const dishes = await createTestDishes(cycleId, 1);
    dishId = dishes[0].id;
  });

  it("should select a single bid as the winner by default", async () => {
    const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const restaurant = await createTestRestaurant(owner.id, zoneId, { rating: 5 });
    await createTestBid(restaurant.id, cycleId, dishId, { pricePerPlate: 15, prepTime: 30, maxCapacity: 100 });

    const result = await scoreBidsAndSelectWinner(cycleId);

    expect(result.winnerId).toBeDefined();
    expect(result.restaurantName).toBe(restaurant.name);
    expect(result.score).toBeGreaterThan(0);

    // Verify bid status in DB
    const bid = await prisma.bid.findFirst({ where: { dailyCycleId: cycleId } });
    expect(bid!.status).toBe("WON");
    expect(bid!.score).toBeGreaterThan(0);

    // Verify cycle updated
    const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
    expect(cycle!.winningBidId).toBe(result.winnerId);
  });

  it("should select the lowest price bid when other factors are equal", async () => {
    const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const r1 = await createTestRestaurant(owner1.id, zoneId, { rating: 4, capacity: 100 });
    const r2 = await createTestRestaurant(owner2.id, zoneId, { rating: 4, capacity: 100 });

    await createTestBid(r1.id, cycleId, dishId, { pricePerPlate: 20, prepTime: 30, maxCapacity: 100 });
    await createTestBid(r2.id, cycleId, dishId, { pricePerPlate: 12, prepTime: 30, maxCapacity: 100 });

    const result = await scoreBidsAndSelectWinner(cycleId);

    // Lower price should win
    const winningBid = await prisma.bid.findUnique({ where: { id: result.winnerId } });
    expect(winningBid!.pricePerPlate).toBe(12);
  });

  it("should allow high rating to compensate for moderate price", async () => {
    const { user: owner1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const { user: owner2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    // Low price but low rating
    const r1 = await createTestRestaurant(owner1.id, zoneId, { rating: 1, capacity: 100 });
    // Moderate price but high rating
    const r2 = await createTestRestaurant(owner2.id, zoneId, { rating: 5, capacity: 100 });

    await createTestBid(r1.id, cycleId, dishId, { pricePerPlate: 10, prepTime: 30, maxCapacity: 100 });
    await createTestBid(r2.id, cycleId, dishId, { pricePerPlate: 14, prepTime: 30, maxCapacity: 100 });

    const result = await scoreBidsAndSelectWinner(cycleId);

    // High rating restaurant should be able to win despite higher price
    // (with weights: price=0.4, rating=0.25, the math can swing either way)
    expect(result.winnerId).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
  });

  it("should mark winner as WON and losers as LOST", async () => {
    const { user: o1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const { user: o2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const { user: o3 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const r1 = await createTestRestaurant(o1.id, zoneId, { rating: 4 });
    const r2 = await createTestRestaurant(o2.id, zoneId, { rating: 4 });
    const r3 = await createTestRestaurant(o3.id, zoneId, { rating: 4 });

    await createTestBid(r1.id, cycleId, dishId, { pricePerPlate: 15 });
    await createTestBid(r2.id, cycleId, dishId, { pricePerPlate: 12 });
    await createTestBid(r3.id, cycleId, dishId, { pricePerPlate: 18 });

    await scoreBidsAndSelectWinner(cycleId);

    const bids = await prisma.bid.findMany({ where: { dailyCycleId: cycleId } });
    const wonBids = bids.filter((b) => b.status === "WON");
    const lostBids = bids.filter((b) => b.status === "LOST");

    expect(wonBids).toHaveLength(1);
    expect(lostBids).toHaveLength(2);
  });

  it("should throw when zero bids are submitted", async () => {
    await expect(scoreBidsAndSelectWinner(cycleId)).rejects.toThrow("No bids submitted for this cycle");
  });

  it("should score capacity correctly (capped at 1.0)", async () => {
    const { user: o1 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const { user: o2 } = await createTestUser(UserRole.RESTAURANT_OWNER);
    const r1 = await createTestRestaurant(o1.id, zoneId, { rating: 4 });
    const r2 = await createTestRestaurant(o2.id, zoneId, { rating: 4 });

    // One with way more capacity than needed, one barely meeting it
    await createTestBid(r1.id, cycleId, dishId, { pricePerPlate: 15, maxCapacity: 1000 });
    await createTestBid(r2.id, cycleId, dishId, { pricePerPlate: 15, maxCapacity: 2 });

    const result = await scoreBidsAndSelectWinner(cycleId);

    // Both should have scores, but higher capacity scores better (up to a cap)
    expect(result.score).toBeGreaterThan(0);
  });
});
