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

test.describe("Dashboard Page", () => {
  test("analytics data displays in 5 stat cards", async ({ page }) => {
    await page.route("**/api/admin/analytics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYTICS),
      })
    );
    await page.goto("/dashboard");

    await expect(page.getByText("Users")).toBeVisible();
    await expect(page.getByText("150")).toBeVisible();
    await expect(page.getByText("Restaurants")).toBeVisible();
    await expect(page.getByText("12")).toBeVisible();
    await expect(page.getByText("Suppliers")).toBeVisible();
    await expect(page.getByText("8")).toBeVisible();
    await expect(page.getByText("Cycles")).toBeVisible();
    await expect(page.getByText("45")).toBeVisible();
    await expect(page.getByText("Orders")).toBeVisible();
    await expect(page.getByText("320")).toBeVisible();
  });

  test('"Cycle Controls" section is visible', async ({ page }) => {
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
    await page.route("**/api/admin/analytics", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );
    await page.goto("/dashboard");

    // Should show 0 for all stats as fallback
    const zeroCells = page.locator("text=0");
    await expect(zeroCells.first()).toBeVisible();
    await expect(page.getByText("Users")).toBeVisible();
  });

  test("loading state visible before data loads", async ({ page }) => {
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
