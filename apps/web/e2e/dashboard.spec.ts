import { test, expect } from "@playwright/test";

const MOCK_ANALYTICS = {
  data: {
    totals: {
      users: 150,
      restaurants: 12,
      suppliers: 8,
      cycles: 45,
      orders: 320,
    },
    today: [],
  },
};

const MOCK_ADMIN = {
  data: { id: "admin-1", name: "Admin User", email: "admin@test.com", role: "ADMIN" },
};

/** Inject auth so dashboard fetches analytics instead of showing zeros. */
async function injectAdminAuth(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "fake-admin-token");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ADMIN) })
  );
}

test.describe("Dashboard Page", () => {
  test("analytics data displays in 5 stat cards", async ({ page }) => {
    await injectAdminAuth(page);
    await page.route("**/api/admin/analytics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      })
    );
    await page.goto("/dashboard");

    // Each stat card is a bordered div with label + value
    const statCards = page.locator(".grid.gap-4 > .rounded-lg.border.p-4");
    await expect(statCards).toHaveCount(5);
    await expect(statCards.filter({ hasText: "Users" }).getByText("150")).toBeVisible();
    await expect(statCards.filter({ hasText: "Restaurants" }).getByText("12")).toBeVisible();
    await expect(statCards.filter({ hasText: "Suppliers" }).getByText("8")).toBeVisible();
    await expect(statCards.filter({ hasText: "Cycles" }).getByText("45")).toBeVisible();
    await expect(statCards.filter({ hasText: "Orders" }).getByText("320")).toBeVisible();
  });

  test('"Cycle Controls" section is visible', async ({ page }) => {
    await injectAdminAuth(page);
    await page.route("**/api/admin/analytics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      })
    );
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Cycle Controls" })).toBeVisible();
  });

  test("API failure shows graceful fallback with zeros", async ({ page }) => {
    await injectAdminAuth(page);
    await page.route("**/api/admin/analytics", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );
    await page.goto("/dashboard");

    // Should show 0 for all stats as fallback
    const statCards = page.locator(".grid.gap-4 > .rounded-lg.border.p-4");
    await expect(statCards.first()).toBeVisible();
    await expect(statCards.filter({ hasText: "Users" })).toBeVisible();
  });

  test("loading state visible before data loads", async ({ page }) => {
    await injectAdminAuth(page);
    await page.route("**/api/admin/analytics", async (route) => {
      // Delay the response by 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      });
    });
    await page.goto("/dashboard");

    await expect(page.getByText("Loading analytics...")).toBeVisible();
    // Eventually the data loads
    await expect(page.getByText("150")).toBeVisible({ timeout: 10_000 });
  });
});
