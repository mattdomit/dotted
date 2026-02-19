import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero section renders with title and CTAs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /dish of the day/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vote Today" })).toBeVisible();
    await expect(page.getByRole("link", { name: /I'm a Restaurant/i })).toBeVisible();
  });

  test('"How Dotted Works" shows 4 steps', async ({ page }) => {
    await expect(page.getByRole("heading", { name: "How Dotted Works" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Suggests" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Community Votes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restaurants Bid" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fresh & Served" })).toBeVisible();
  });

  test('"Join as..." shows 3 role cards', async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Join as..." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Consumer", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restaurant", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Supplier", exact: true })).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    // Use nav-scoped locators to avoid matching role cards further down
    const nav = page.locator("nav");

    await nav.getByRole("link", { name: "Today's Vote" }).click();
    await expect(page).toHaveURL("/vote");

    await page.goto("/");
    await nav.getByRole("link", { name: "Daily Cycle" }).click();
    await expect(page).toHaveURL("/cycle");

    await page.goto("/");
    await nav.getByRole("link", { name: "Reviews" }).click();
    await expect(page).toHaveURL("/reviews");
  });

  test("CTA buttons navigate correctly", async ({ page }) => {
    await page.getByRole("link", { name: "Vote Today" }).click();
    await expect(page).toHaveURL("/vote");

    await page.goto("/");
    await page.getByRole("link", { name: /I'm a Restaurant/i }).click();
    await expect(page).toHaveURL("/bids");
  });
});
