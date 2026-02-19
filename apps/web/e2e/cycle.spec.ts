import { test, expect } from "@playwright/test";

const MOCK_STATUS = {
  data: {
    id: "cycle-100",
    status: "VOTING",
    date: "2025-06-15",
    _count: { dishes: 3, votes: 25, bids: 0, orders: 0 },
  },
};

const MOCK_DETAIL = {
  data: {
    id: "cycle-100",
    status: "VOTING",
    date: "2025-06-15",
    zone: { name: "Downtown Demo District", slug: "downtown-demo" },
    dishes: [
      {
        id: "d1",
        name: "Herb-Crusted Salmon",
        description: "Fresh wild salmon with herb crust",
        cuisine: "Seafood",
        voteCount: 15,
        estimatedCost: 18.0,
      },
      {
        id: "d2",
        name: "Mushroom Risotto",
        description: "Creamy risotto with cremini mushrooms",
        cuisine: "Italian",
        voteCount: 10,
        estimatedCost: 12.0,
      },
    ],
  },
};

test.describe("Cycle Page", () => {
  test("heading and zone search form render", async ({ page }) => {
    await page.goto("/cycle");
    await expect(page.getByRole("heading", { name: "Daily Cycle Dashboard" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter Zone ID")).toBeVisible();
    await expect(page.getByRole("button", { name: "Track Cycle" })).toBeVisible();
  });

  test("nonexistent zone shows error message", async ({ page }) => {
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await page.goto("/cycle");
    await page.getByPlaceholder("Enter Zone ID").fill("bad-zone-id");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    await expect(page.getByText("No cycle found for today in this zone")).toBeVisible();
  });

  test("valid zone shows phase card, stats grid, dish list, and timeline", async ({ page }) => {
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STATUS),
      })
    );
    await page.route("**/api/cycles/cycle-100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DETAIL),
      })
    );
    await page.goto("/cycle");
    await page.getByPlaceholder("Enter Zone ID").fill("demo-zone");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    // Phase card
    await expect(page.getByText("Community Voting")).toBeVisible();

    // Stats grid
    await expect(page.getByText("Dishes").first()).toBeVisible();
    await expect(page.getByText("25")).toBeVisible(); // votes count
    await expect(page.getByText("Votes").first()).toBeVisible();

    // Dish list
    await expect(page.getByText("Herb-Crusted Salmon")).toBeVisible();
    await expect(page.getByText("Mushroom Risotto")).toBeVisible();

    // Timeline with "Now" badge
    await expect(page.getByText("Now")).toBeVisible();
  });

  test("all 6 timeline entries are visible", async ({ page }) => {
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STATUS),
      })
    );
    await page.route("**/api/cycles/cycle-100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DETAIL),
      })
    );
    await page.goto("/cycle");
    await page.getByPlaceholder("Enter Zone ID").fill("demo-zone");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    await expect(page.getByText("AI generates dishes")).toBeVisible();
    await expect(page.getByText("Community voting")).toBeVisible();
    await expect(page.getByText("Restaurant bidding")).toBeVisible();
    await expect(page.getByText("Ingredient sourcing")).toBeVisible();
    await expect(page.getByText("Orders open")).toBeVisible();
    await expect(page.getByText("Cycle complete")).toBeVisible();
  });
});
