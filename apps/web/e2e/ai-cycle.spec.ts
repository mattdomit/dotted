import { test, expect } from "@playwright/test";

const MOCK_ZONES = {
  data: [
    { id: "zone-1", name: "Downtown Demo District", slug: "downtown-demo", city: "Austin", state: "TX" },
  ],
};

const MOCK_ADMIN_USER = {
  data: {
    id: "admin-1",
    name: "Admin User",
    email: "admin@test.com",
    role: "ADMIN",
    emailVerified: true,
  },
};

const MOCK_STATUS_SUGGESTING = {
  data: {
    id: "cycle-ai-1",
    status: "SUGGESTING",
    date: "2025-06-15",
    _count: { dishes: 0, votes: 0, bids: 0, orders: 0 },
  },
};

const MOCK_STATUS_VOTING = {
  data: {
    id: "cycle-ai-1",
    status: "VOTING",
    date: "2025-06-15",
    _count: { dishes: 3, votes: 0, bids: 0, orders: 0 },
  },
};

const MOCK_CYCLE_DETAIL_VOTING = {
  data: {
    id: "cycle-ai-1",
    status: "VOTING",
    date: "2025-06-15",
    zone: { name: "Downtown Demo District", slug: "downtown-demo" },
    dishes: [
      {
        id: "d-ai-1",
        name: "Seasonal Garden Bowl",
        description: "Fresh seasonal vegetables with grains",
        cuisine: "American",
        voteCount: 0,
        estimatedCost: 10.0,
      },
      {
        id: "d-ai-2",
        name: "Pasta Primavera",
        description: "Classic Italian pasta with spring vegetables",
        cuisine: "Italian",
        voteCount: 0,
        estimatedCost: 12.0,
      },
      {
        id: "d-ai-3",
        name: "Spicy Black Bean Tacos",
        description: "Authentic Mexican tacos with black beans",
        cuisine: "Mexican",
        voteCount: 0,
        estimatedCost: 9.0,
      },
    ],
  },
};

async function injectAdminAuth(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "fake-admin-token");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ADMIN_USER) })
  );
}

test.describe("AI Cycle — Suggest → Vote → Bid Flow", () => {
  test("cycle page shows SUGGESTING status", async ({ page }) => {
    await page.route("**/api/zones", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONES) })
    );
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS_SUGGESTING) })
    );
    await page.route(/\/api\/cycles\/cycle-ai-1$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "cycle-ai-1",
            status: "SUGGESTING",
            date: "2025-06-15",
            zone: { name: "Downtown Demo District", slug: "downtown-demo" },
            dishes: [],
          },
        }),
      })
    );

    await page.goto("/cycle");
    await page.locator("#zoneId").selectOption("zone-1");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    await expect(page.getByText("AI Suggesting", { exact: true })).toBeVisible();
  });

  test("AI-generated dishes appear in voting phase", async ({ page }) => {
    await page.route("**/api/zones", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONES) })
    );
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS_VOTING) })
    );
    await page.route(/\/api\/cycles\/cycle-ai-1$/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CYCLE_DETAIL_VOTING) })
    );

    await page.goto("/cycle");
    await page.locator("#zoneId").selectOption("zone-1");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    await expect(page.getByText("Seasonal Garden Bowl")).toBeVisible();
    await expect(page.getByText("Pasta Primavera")).toBeVisible();
    await expect(page.getByText("Spicy Black Bean Tacos")).toBeVisible();
    await expect(page.getByText("American")).toBeVisible();
    await expect(page.getByText("Italian")).toBeVisible();
    await expect(page.getByText("Mexican")).toBeVisible();
  });

  test("vote page shows AI-generated dishes and allows voting", async ({ page }) => {
    await injectAdminAuth(page);
    await page.route("**/api/cycles/today*", (route) => {
      // Intercept the vote page's cycle request
      if (route.request().url().includes("/status")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS_VOTING) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "cycle-ai-1",
            status: "VOTING",
            dishes: MOCK_CYCLE_DETAIL_VOTING.data.dishes,
          },
        }),
      });
    });
    await page.route("**/api/votes", (route) =>
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true }) })
    );

    await page.goto("/vote");

    await expect(page.getByText("Seasonal Garden Bowl")).toBeVisible();
    await expect(page.getByText("Pasta Primavera")).toBeVisible();

    // Vote for one dish
    const voteButtons = page.getByRole("button", { name: "Vote for This" });
    await voteButtons.first().click();

    await expect(page.getByRole("button", { name: "Voted!" })).toBeVisible();
  });

  test("bidding phase shows on cycle page", async ({ page }) => {
    await page.route("**/api/zones", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONES) })
    );
    await page.route("**/api/cycles/today/status*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "cycle-ai-1",
            status: "BIDDING",
            date: "2025-06-15",
            _count: { dishes: 3, votes: 45, bids: 2, orders: 0 },
          },
        }),
      })
    );
    await page.route(/\/api\/cycles\/cycle-ai-1$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...MOCK_CYCLE_DETAIL_VOTING.data,
            status: "BIDDING",
          },
        }),
      })
    );

    await page.goto("/cycle");
    await page.locator("#zoneId").selectOption("zone-1");
    await page.getByRole("button", { name: "Track Cycle" }).click();

    // Phase shows bidding
    await expect(page.getByText("Restaurant Bidding", { exact: true })).toBeVisible();
    await expect(page.getByText("45")).toBeVisible(); // vote count
  });
});
