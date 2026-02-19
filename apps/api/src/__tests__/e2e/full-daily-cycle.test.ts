import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { createApp } from "../helpers/app";
import { cleanDatabase } from "../helpers/db";
import { createTestUser, getAuthHeader } from "../helpers/auth";
import { createTestZone, createTestRestaurant, createTestSupplierWithInventory } from "../helpers/fixtures";
import { createMockAnthropicResponse, createSampleDishSuggestions, createMockSubstitutionResponse } from "../helpers/mocks";

// Mock Anthropic SDK at module level — use vi.hoisted for mock hoisting
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Mock socket handlers to avoid real socket operations
vi.mock("../../socket/handlers", () => ({
  getIO: vi.fn().mockReturnValue(null),
}));

const app = createApp();

describe("E2E: Full Daily Cycle", () => {
  // State accumulated across sequential steps
  let adminToken: string;
  let zoneId: string;
  let cycleId: string;
  let dishIds: string[] = [];
  let winningDishId: string;
  let consumers: { token: string; userId: string }[] = [];
  let restaurants: { token: string; userId: string; restaurantId: string }[] = [];
  let winningBidRestaurantId: string;
  let orderIds: string[] = [];

  beforeAll(async () => {
    await cleanDatabase();
    mockCreate.mockReset();

    // Create admin
    const { token: aToken } = await createTestUser(UserRole.ADMIN);
    adminToken = aToken;

    // Create zone
    const zone = await createTestZone({ name: "E2E Test Zone" });
    zoneId = zone.id;

    // Create 5 consumers and join zone
    for (let i = 0; i < 5; i++) {
      const { token, user } = await createTestUser(UserRole.CONSUMER);
      consumers.push({ token, userId: user.id });
      await prisma.zoneMembership.create({ data: { userId: user.id, zoneId } });
    }

    // Create 3 restaurant owners with restaurants
    for (let i = 0; i < 3; i++) {
      const { token, user } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(user.id, zoneId, { rating: 3 + i });
      restaurants.push({ token, userId: user.id, restaurantId: restaurant.id });
    }

    // Create supplier with inventory
    const { user: supplierOwner } = await createTestUser(UserRole.SUPPLIER);
    await createTestSupplierWithInventory(supplierOwner.id, zoneId);
  });

  it("Step 1: Admin creates cycle via POST /api/cycles/create", async () => {
    const res = await request(app)
      .post("/api/cycles/create")
      .set(getAuthHeader(adminToken))
      .send({ zoneId });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("SUGGESTING");
    cycleId = res.body.data.id;
  });

  it("Step 2: SUGGESTING → VOTING — AI generates 4 dishes", async () => {
    const sampleDishes = createSampleDishSuggestions(4);
    mockCreate.mockResolvedValue(createMockAnthropicResponse(sampleDishes));

    const res = await request(app)
      .post("/api/cycles/transition")
      .set(getAuthHeader(adminToken))
      .send({ cycleId, targetStatus: "VOTING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("VOTING");

    // Verify 4 dishes created
    const dishes = await prisma.dish.findMany({ where: { dailyCycleId: cycleId } });
    expect(dishes).toHaveLength(4);
    dishIds = dishes.map((d) => d.id);
  });

  it("Step 3: VOTING — 5 consumers vote (dish[0] gets 3 votes = winner)", async () => {
    // Consumer 0, 1, 2 vote for dish[0]
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/votes")
        .set(getAuthHeader(consumers[i].token))
        .send({ dishId: dishIds[0], dailyCycleId: cycleId });
      expect(res.status).toBe(201);
    }

    // Consumer 3 votes for dish[1]
    await request(app)
      .post("/api/votes")
      .set(getAuthHeader(consumers[3].token))
      .send({ dishId: dishIds[1], dailyCycleId: cycleId });

    // Consumer 4 votes for dish[2]
    await request(app)
      .post("/api/votes")
      .set(getAuthHeader(consumers[4].token))
      .send({ dishId: dishIds[2], dailyCycleId: cycleId });

    // Verify duplicate vote blocked
    const dupeRes = await request(app)
      .post("/api/votes")
      .set(getAuthHeader(consumers[0].token))
      .send({ dishId: dishIds[1], dailyCycleId: cycleId });
    expect(dupeRes.status).toBe(409);

    // Verify vote counts
    const topDish = await prisma.dish.findUnique({ where: { id: dishIds[0] } });
    expect(topDish!.voteCount).toBe(3);
  });

  it("Step 4: VOTING → BIDDING — tallyVotes() sets winningDishId", async () => {
    const res = await request(app)
      .post("/api/cycles/transition")
      .set(getAuthHeader(adminToken))
      .send({ cycleId, targetStatus: "BIDDING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("BIDDING");

    const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
    expect(cycle!.winningDishId).toBe(dishIds[0]);
    winningDishId = dishIds[0];
  });

  it("Step 5: BIDDING — 3 restaurants submit bids, consumer bid blocked", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/bids")
        .set(getAuthHeader(restaurants[i].token))
        .send({
          restaurantId: restaurants[i].restaurantId,
          dailyCycleId: cycleId,
          dishId: winningDishId,
          pricePerPlate: 12 + i * 3,
          prepTime: 30 + i * 10,
          maxCapacity: 50 + i * 25,
          serviceFeeAccepted: true,
        });
      expect(res.status).toBe(201);
    }

    // Consumer cannot bid (wrong role)
    const consumerBid = await request(app)
      .post("/api/bids")
      .set(getAuthHeader(consumers[0].token))
      .send({
        restaurantId: restaurants[0].restaurantId,
        dailyCycleId: cycleId,
        dishId: winningDishId,
        pricePerPlate: 10,
        prepTime: 20,
        maxCapacity: 50,
        serviceFeeAccepted: true,
      });
    expect(consumerBid.status).toBe(403);
  });

  it("Step 6: BIDDING → SOURCING — Bids scored, winner selected, purchase orders created", async () => {
    const res = await request(app)
      .post("/api/cycles/transition")
      .set(getAuthHeader(adminToken))
      .send({ cycleId, targetStatus: "SOURCING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SOURCING");

    // Verify winning bid
    const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
    expect(cycle!.winningBidId).toBeDefined();

    const bids = await prisma.bid.findMany({ where: { dailyCycleId: cycleId } });
    const won = bids.filter((b) => b.status === "WON");
    const lost = bids.filter((b) => b.status === "LOST");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(2);

    winningBidRestaurantId = won[0].restaurantId;

    // Verify purchase orders created
    const pos = await prisma.purchaseOrder.findMany({ where: { dailyCycleId: cycleId } });
    expect(pos.length).toBeGreaterThan(0);
  });

  it("Step 7: SOURCING → ORDERING — Status updated", async () => {
    const res = await request(app)
      .post("/api/cycles/transition")
      .set(getAuthHeader(adminToken))
      .send({ cycleId, targetStatus: "ORDERING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ORDERING");
  });

  it("Step 8: ORDERING — Consumers place orders, owner confirms, consumer reviews", async () => {
    // 2 consumers place orders
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post("/api/orders")
        .set(getAuthHeader(consumers[i].token))
        .send({ dailyCycleId: cycleId, restaurantId: winningBidRestaurantId, quantity: 2, fulfillmentType: "PICKUP" });

      expect(res.status).toBe(201);
      expect(res.body.data.totalPrice).toBeGreaterThan(0);
      orderIds.push(res.body.data.id);
    }

    // Restaurant owner confirms the first order
    const ownerOfWinner = restaurants.find((r) => r.restaurantId === winningBidRestaurantId)!;
    const confirmRes = await request(app)
      .patch(`/api/orders/${orderIds[0]}/status`)
      .set(getAuthHeader(ownerOfWinner.token))
      .send({ status: "CONFIRMED" });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("CONFIRMED");

    // Consumer leaves a review
    const reviewRes = await request(app)
      .post("/api/reviews")
      .set(getAuthHeader(consumers[0].token))
      .send({
        restaurantId: winningBidRestaurantId,
        orderId: orderIds[0],
        rating: 5,
        title: "Excellent meal!",
        body: "The dish of the day was absolutely amazing, great service!",
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.rating).toBe(5);
  });

  it("Step 9: ORDERING → COMPLETED — Cycle closes", async () => {
    const res = await request(app)
      .post("/api/cycles/transition")
      .set(getAuthHeader(adminToken))
      .send({ cycleId, targetStatus: "COMPLETED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("COMPLETED");
  });

  it("Step 10: Post-cycle — Vote/bid/order attempts fail; admin analytics reflect cycle", async () => {
    // Vote attempt fails (cycle not in VOTING)
    const voteRes = await request(app)
      .post("/api/votes")
      .set(getAuthHeader(consumers[0].token))
      .send({ dishId: dishIds[0], dailyCycleId: cycleId });
    expect(voteRes.status).toBe(400);

    // Bid attempt fails (cycle not in BIDDING)
    const bidRes = await request(app)
      .post("/api/bids")
      .set(getAuthHeader(restaurants[0].token))
      .send({
        restaurantId: restaurants[0].restaurantId,
        dailyCycleId: cycleId,
        dishId: winningDishId,
        pricePerPlate: 10,
        prepTime: 20,
        maxCapacity: 50,
        serviceFeeAccepted: true,
      });
    expect(bidRes.status).toBe(400);

    // Order attempt fails (cycle not in ORDERING)
    const orderRes = await request(app)
      .post("/api/orders")
      .set(getAuthHeader(consumers[2].token))
      .send({ dailyCycleId: cycleId, restaurantId: winningBidRestaurantId, quantity: 1, fulfillmentType: "PICKUP" });
    expect(orderRes.status).toBe(400);

    // Admin analytics should reflect data
    const analyticsRes = await request(app)
      .get("/api/admin/analytics")
      .set(getAuthHeader(adminToken));

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.totals.orders).toBeGreaterThanOrEqual(2);
    expect(analyticsRes.body.data.totals.cycles).toBeGreaterThanOrEqual(1);
  });
});
