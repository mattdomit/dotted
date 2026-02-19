import { test, expect } from "@playwright/test";

test.describe("Cross-Flow Navigation", () => {
  test("consumer journey: home -> vote -> cycle -> reviews", async ({ page }) => {
    await page.goto("/");

    // Home -> Vote
    await page.getByRole("link", { name: "Vote Today" }).click();
    await expect(page).toHaveURL("/vote");

    // Vote -> Cycle (go back to home first, then navigate)
    await page.goto("/");
    await page.getByRole("link", { name: "Daily Cycle" }).click();
    await expect(page).toHaveURL("/cycle");

    // Cycle -> Reviews
    await page.goto("/");
    await page.getByRole("link", { name: "Reviews" }).click();
    await expect(page).toHaveURL("/reviews");
    await expect(page.getByRole("heading", { name: "Restaurant Reviews" })).toBeVisible();
  });

  test("restaurant owner: bids (no restaurant) -> enroll page", async ({ page }) => {
    // Set up a token so bids page doesn't show "Sign In Required"
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token-for-nav-test");
    });

    // Mock the restaurant lookup to return 404
    await page.route("**/api/restaurants/mine", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );

    await page.goto("/bids");
    await expect(
      page.getByRole("heading", { name: "Enrollment Required" })
    ).toBeVisible();

    // Click enroll link
    await page.getByRole("link", { name: "Enroll Your Restaurant" }).click();
    await expect(page).toHaveURL("/enroll");
    await expect(
      page.getByRole("heading", { name: "Restaurant Enrollment" })
    ).toBeVisible();
  });

  test("supplier: home -> inventory -> add/remove items", async ({ page }) => {
    await page.goto("/");

    // Click Supplier role card -> /inventory
    await page.getByRole("heading", { name: "Supplier" }).click();
    await expect(page).toHaveURL("/inventory");

    // Add an item
    await page.locator("#ingredientName").fill("Fresh Basil");
    await page.locator("#category").selectOption("Herbs");
    await page.locator("#unit").fill("bunch");
    await page.locator("#pricePerUnit").fill("2.50");
    await page.locator("#quantityAvailable").fill("80");
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("Fresh Basil")).toBeVisible();
    await expect(page.getByText("1 items")).toBeVisible();

    // Remove the item
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No items yet")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();
  });
});
