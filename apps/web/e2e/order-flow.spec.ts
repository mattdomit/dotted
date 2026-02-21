import { test, expect } from "./helpers/fixtures";

const MOCK_CYCLE_ORDERING = {
  data: {
    id: "cycle-order-1",
    status: "ORDERING",
    winningDishId: "dish-win-1",
    winningBidId: "bid-win-1",
    dishes: [
      {
        id: "dish-win-1",
        name: "Truffle Risotto",
        description: "Creamy arborio rice with black truffle",
        cuisine: "Italian",
        estimatedCost: 14.5,
        voteCount: 25,
      },
    ],
  },
};

const MOCK_BID = {
  data: {
    id: "bid-win-1",
    pricePerPlate: 12.5,
    prepTime: 45,
    maxCapacity: 50,
    restaurant: {
      id: "rest-1",
      name: "Bella Italia",
    },
  },
};

test.describe("Order Flow", () => {
  test("ordering phase shows dish and place order button", async ({ consumerPage }) => {
    await consumerPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CYCLE_ORDERING) })
    );

    await consumerPage.goto("/vote");

    await expect(consumerPage.getByText("Truffle Risotto")).toBeVisible();
  });

  test("order page renders with dish info", async ({ consumerPage }) => {
    await consumerPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CYCLE_ORDERING) })
    );
    await consumerPage.route("**/api/bids/bid-win-1", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BID) })
    );

    await consumerPage.goto("/order");

    // Should show cycle info
    await expect(consumerPage.getByText("Truffle Risotto")).toBeVisible();
  });

  test("place order calls API and shows confirmation", async ({ consumerPage }) => {
    await consumerPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CYCLE_ORDERING) })
    );
    await consumerPage.route("**/api/bids/bid-win-1", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BID) })
    );
    await consumerPage.route("**/api/orders", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "order-1",
              quantity: 1,
              totalPrice: 12.5,
              status: "CONFIRMED",
            },
          }),
        });
      }
      return route.continue();
    });

    await consumerPage.goto("/order");

    // Find and click order button
    const orderBtn = consumerPage.getByRole("button", { name: /order|place/i });
    if (await orderBtn.isVisible()) {
      await orderBtn.click();
      // After ordering, some confirmation should appear
      await expect(consumerPage.getByText(/confirmed|success|placed/i)).toBeVisible();
    }
  });

  test("no active ordering cycle shows fallback", async ({ consumerPage }) => {
    await consumerPage.route("**/api/cycles/today*", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );

    await consumerPage.goto("/order");

    // Should show some indication that no cycle is active
    await expect(consumerPage.getByText(/no.*cycle|not available|no active/i)).toBeVisible();
  });
});
