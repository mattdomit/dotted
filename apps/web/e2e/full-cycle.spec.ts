import { test, expect } from "./helpers/fixtures";

/**
 * Full day-cycle E2E test — tests the complete flow across multiple pages
 * using route mocking. Covers: suggest → vote → bid → order phases.
 */

const MOCK_ZONES = {
  data: [
    { id: "zone-1", name: "Downtown Demo District", slug: "downtown-demo", city: "Austin", state: "TX" },
  ],
};

const MOCK_CYCLE_VOTING = {
  data: {
    id: "cycle-full-1",
    status: "VOTING",
    dishes: [
      {
        id: "dish-full-1",
        name: "Farm-Fresh Risotto",
        description: "Locally sourced risotto with seasonal mushrooms",
        cuisine: "Italian",
        estimatedCost: 13.0,
        voteCount: 0,
        ingredients: [
          { name: "Arborio Rice", quantity: 2, unit: "cups" },
          { name: "Mushrooms", quantity: 0.5, unit: "kg" },
        ],
      },
      {
        id: "dish-full-2",
        name: "Spiced Chickpea Bowl",
        description: "Mediterranean chickpeas with tahini dressing",
        cuisine: "Mediterranean",
        estimatedCost: 9.5,
        voteCount: 0,
        ingredients: [
          { name: "Chickpeas", quantity: 1, unit: "kg" },
          { name: "Tahini", quantity: 0.2, unit: "liters" },
        ],
      },
    ],
  },
};

const MOCK_CYCLE_BIDDING = {
  data: {
    id: "cycle-full-1",
    status: "BIDDING",
    winningDishId: "dish-full-1",
    dishes: [{ id: "dish-full-1", name: "Farm-Fresh Risotto" }],
  },
};

const MOCK_RESTAURANT = {
  data: {
    id: "rest-full-1",
    name: "Trattoria Milano",
    address: "789 Food Ave",
    capacity: 100,
    isVerified: true,
    cuisineTypes: ["Italian", "Mediterranean"],
    kitchenCapacity: 80,
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    zoneId: "zone-1",
  },
};

const MOCK_CYCLE_ORDERING = {
  data: {
    id: "cycle-full-1",
    status: "ORDERING",
    winningDishId: "dish-full-1",
    winningBidId: "bid-full-1",
    dishes: [
      {
        id: "dish-full-1",
        name: "Farm-Fresh Risotto",
        description: "Locally sourced risotto with seasonal mushrooms",
        cuisine: "Italian",
        estimatedCost: 13.0,
        voteCount: 18,
      },
    ],
  },
};

test.describe("Full Cycle — Multi-role Day Flow", () => {
  test("consumer: view dishes in voting phase and vote", async ({ consumerPage }) => {
    await consumerPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CYCLE_VOTING),
      })
    );
    await consumerPage.route("**/api/votes", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );

    await consumerPage.goto("/vote");

    // See the AI-generated dishes
    await expect(consumerPage.getByText("Farm-Fresh Risotto")).toBeVisible();
    await expect(consumerPage.getByText("Spiced Chickpea Bowl")).toBeVisible();
    await expect(consumerPage.getByText("Italian")).toBeVisible();
    await expect(consumerPage.getByText("Mediterranean")).toBeVisible();

    // Vote for risotto
    const voteButtons = consumerPage.getByRole("button", { name: "Vote for This" });
    await voteButtons.first().click();

    await expect(consumerPage.getByRole("button", { name: "Voted!" })).toBeVisible();
    await expect(consumerPage.getByText("1 votes")).toBeVisible(); // optimistic
  });

  test("restaurant owner: bid on winning dish", async ({ restaurantPage }) => {
    await restaurantPage.route("**/api/restaurants/mine", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESTAURANT),
      })
    );
    await restaurantPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CYCLE_BIDDING),
      })
    );
    await restaurantPage.route("**/api/bids", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: "bid-full-1" } }),
      })
    );

    await restaurantPage.goto("/bids");

    await expect(restaurantPage.getByText("Trattoria Milano")).toBeVisible();

    // Submit bid
    await restaurantPage.locator("#pricePerPlate").fill("13.00");
    await restaurantPage.locator("#prepTime").fill("40");
    await restaurantPage.locator("#maxCapacity").fill("60");
    await restaurantPage.getByRole("button", { name: "Submit Bid" }).click();

    await expect(restaurantPage.getByText("Bid Submitted!")).toBeVisible();
  });

  test("cycle dashboard: track full cycle phases", async ({ page }) => {
    await page.route("**/api/zones", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONES) })
    );

    // Show ORDERING phase
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "cycle-full-1",
            status: "ORDERING",
            date: "2025-06-15",
            _count: { dishes: 2, votes: 18, bids: 3, orders: 5 },
          },
        }),
      })
    );
    await page.route(/\/api\/cycles\/cycle-full-1$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...MOCK_CYCLE_ORDERING.data,
            zone: { name: "Downtown Demo District", slug: "downtown-demo" },
          },
        }),
      })
    );

    await page.goto("/cycle");
    await page.locator("#zoneId").selectOption("zone-1");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    // Verify ordering phase
    await expect(page.getByText("Orders Open", { exact: true })).toBeVisible();
    await expect(page.getByText("18")).toBeVisible(); // votes
    await expect(page.getByText("3")).toBeVisible(); // bids
  });

  test("supplier: manage deliveries for the cycle", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "po-full-001-aaa-bbb",
              status: "APPROVED",
              totalCost: 180.0,
              createdAt: "2025-06-15T14:00:00Z",
              items: [
                { inventoryItem: { ingredientName: "Arborio Rice", unit: "kg" }, quantity: 10, unitPrice: 8.0 },
                { inventoryItem: { ingredientName: "Mushrooms", unit: "kg" }, quantity: 5, unitPrice: 20.0 },
              ],
            },
          ],
        }),
      })
    );
    await supplierPage.route("**/api/delivery/purchase-orders/*/delivery", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );

    await supplierPage.goto("/delivery");

    await expect(supplierPage.getByText("Arborio Rice")).toBeVisible();
    await expect(supplierPage.getByText("Mushrooms")).toBeVisible();
    await expect(supplierPage.getByText("$180.00")).toBeVisible();

    // Update to dispatched
    await supplierPage.getByRole("button", { name: "DISPATCHED" }).click();
    await supplierPage.waitForResponse("**/api/suppliers/orders");
  });

  test("consumer: view community feed after cycle", async ({ consumerPage }) => {
    await consumerPage.route("**/api/zones/mine", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: "mem-1", zoneId: "zone-1" }] }),
      })
    );
    await consumerPage.route("**/api/feed/zones/zone-1/feed*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "post-cycle-1",
              body: "Today's Farm-Fresh Risotto was incredible! The mushrooms were so fresh.",
              imageUrl: null,
              createdAt: "2025-06-15T20:00:00Z",
              user: { name: "Happy Consumer" },
              commentCount: 5,
              likeCount: 12,
            },
          ],
        }),
      })
    );

    await consumerPage.goto("/community");

    await expect(consumerPage.getByText("Farm-Fresh Risotto was incredible")).toBeVisible();
    await expect(consumerPage.getByText("12 Likes")).toBeVisible();
    await expect(consumerPage.getByText("5 Comments")).toBeVisible();
  });

  test("consumer: write review after meal", async ({ consumerPage }) => {
    await consumerPage.route("**/api/restaurants", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "rest-full-1", name: "Trattoria Milano", address: "789 Food Ave", rating: 0 }],
        }),
      })
    );
    await consumerPage.route("**/api/reviews", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { id: "review-cycle-1" } }),
        });
      }
      return route.continue();
    });

    await consumerPage.goto("/reviews");
    await consumerPage.getByRole("button", { name: "Write a Review" }).click();

    await consumerPage.locator("#review-restaurantId").selectOption("rest-full-1");
    await consumerPage.locator("#review-title").fill("Amazing Risotto from Today's Cycle");
    await consumerPage.locator("#review-body").fill("The Farm-Fresh Risotto was cooked perfectly. Fresh mushrooms made it special.");
    await consumerPage.getByRole("button", { name: "Post Review" }).click();

    await expect(consumerPage.getByText("Review posted successfully")).toBeVisible();
  });
});
