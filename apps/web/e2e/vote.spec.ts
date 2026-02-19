import { test, expect } from "@playwright/test";

const MOCK_CYCLE = {
  data: {
    id: "cycle-001",
    status: "VOTING",
    dishes: [
      {
        id: "dish-1",
        name: "Truffle Risotto",
        description: "Creamy arborio rice with black truffle",
        cuisine: "Italian",
        estimatedCost: 14.5,
        voteCount: 12,
        ingredients: [
          { name: "Arborio Rice", quantity: 2, unit: "cups" },
          { name: "Black Truffle", quantity: 1, unit: "oz" },
        ],
      },
      {
        id: "dish-2",
        name: "Spicy Tuna Bowl",
        description: "Fresh tuna with sriracha mayo and rice",
        cuisine: "Japanese",
        estimatedCost: 16.0,
        voteCount: 8,
        ingredients: [
          { name: "Tuna", quantity: 6, unit: "oz" },
          { name: "Sushi Rice", quantity: 1, unit: "cup" },
        ],
      },
    ],
  },
};

test.describe("Vote Page", () => {
  test("no active cycle shows fallback heading", async ({ page }) => {
    await page.route("**/api/cycles/today*", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await page.goto("/vote");
    await expect(page.getByRole("heading", { name: "No Active Cycle" })).toBeVisible();
  });

  test("dishes display with names, cuisine tags, vote counts, and percentages", async ({ page }) => {
    await page.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CYCLE),
      })
    );
    await page.goto("/vote");

    await expect(page.getByRole("heading", { name: "Truffle Risotto" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Spicy Tuna Bowl" })).toBeVisible();
    await expect(page.getByText("Italian")).toBeVisible();
    await expect(page.getByText("Japanese")).toBeVisible();
    await expect(page.getByText("12 votes")).toBeVisible();
    await expect(page.getByText("60%")).toBeVisible();
    await expect(page.getByText("8 votes")).toBeVisible();
    await expect(page.getByText("40%")).toBeVisible();
  });

  test('click "Vote for This" triggers optimistic update', async ({ page }) => {
    await page.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CYCLE),
      })
    );
    await page.route("**/api/votes", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );
    await page.goto("/vote");

    const voteButtons = page.getByRole("button", { name: "Vote for This" });
    await voteButtons.first().click();

    await expect(page.getByRole("button", { name: "Voted!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Already Voted" })).toBeVisible();
    await expect(page.getByText("13 votes")).toBeVisible();
  });

  test("non-VOTING phase disables vote buttons", async ({ page }) => {
    const biddingCycle = {
      data: { ...MOCK_CYCLE.data, status: "BIDDING" },
    };
    await page.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(biddingCycle),
      })
    );
    await page.goto("/vote");

    await expect(page.getByText("Voting is bidding")).toBeVisible();
    const buttons = page.getByRole("button", { name: "Vote for This" });
    await expect(buttons.first()).toBeDisabled();
  });

  test("vote API returns 409 shows error message", async ({ page }) => {
    await page.route("**/api/cycles/today*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CYCLE),
      })
    );
    await page.route("**/api/votes", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "Already voted in this cycle" }),
      })
    );
    await page.goto("/vote");

    await page.getByRole("button", { name: "Vote for This" }).first().click();
    await expect(page.getByText("Already voted in this cycle")).toBeVisible();
  });
});
