import { test, expect } from "@playwright/test";

test.describe("Inventory Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/inventory");
  });

  test('empty state shows "No items yet" and count shows 0', async ({ page }) => {
    await expect(page.getByText("No items yet")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();
  });

  test("fill form + Add Item adds item to list with all details", async ({ page }) => {
    await page.locator("#ingredientName").fill("Organic Tomatoes");
    await page.locator("#category").selectOption("Vegetables");
    await page.locator("#unit").fill("lb");
    await page.locator("#pricePerUnit").fill("3.50");
    await page.locator("#quantityAvailable").fill("200");
    await page.locator("#isOrganic").check();
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("Organic Tomatoes")).toBeVisible();
    await expect(page.getByText("Organic", { exact: true })).toBeVisible();
    await expect(page.getByText("200 lb")).toBeVisible();
    await expect(page.getByText("$3.50/lb")).toBeVisible();
    await expect(page.getByText("(Vegetables)")).toBeVisible();
    await expect(page.getByText("1 items")).toBeVisible();
  });

  test("add multiple items updates count", async ({ page }) => {
    // Add first item
    await page.locator("#ingredientName").fill("Tomatoes");
    await page.locator("#category").selectOption("Vegetables");
    await page.locator("#unit").fill("lb");
    await page.locator("#pricePerUnit").fill("3.00");
    await page.locator("#quantityAvailable").fill("100");
    await page.getByRole("button", { name: "Add Item" }).click();

    // Add second item
    await page.locator("#ingredientName").fill("Basil");
    await page.locator("#category").selectOption("Herbs");
    await page.locator("#unit").fill("bunch");
    await page.locator("#pricePerUnit").fill("2.50");
    await page.locator("#quantityAvailable").fill("50");
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByText("Tomatoes")).toBeVisible();
    await expect(page.getByText("Basil")).toBeVisible();
  });

  test('click "Remove" removes item and returns to empty state', async ({ page }) => {
    // Add an item first
    await page.locator("#ingredientName").fill("Garlic");
    await page.locator("#category").selectOption("Vegetables");
    await page.locator("#unit").fill("lb");
    await page.locator("#pricePerUnit").fill("5.00");
    await page.locator("#quantityAvailable").fill("80");
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("Garlic")).toBeVisible();
    await expect(page.getByText("1 items")).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText("No items yet")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();
  });

  test("form resets after adding an item", async ({ page }) => {
    await page.locator("#ingredientName").fill("Carrots");
    await page.locator("#category").selectOption("Vegetables");
    await page.locator("#unit").fill("lb");
    await page.locator("#pricePerUnit").fill("1.80");
    await page.locator("#quantityAvailable").fill("300");
    await page.locator("#isOrganic").check();
    await page.getByRole("button", { name: "Add Item" }).click();

    // Verify form fields are reset
    await expect(page.locator("#ingredientName")).toHaveValue("");
    await expect(page.locator("#category")).toHaveValue("");
    await expect(page.locator("#unit")).toHaveValue("");
    await expect(page.locator("#pricePerUnit")).toHaveValue("");
    await expect(page.locator("#quantityAvailable")).toHaveValue("");
    await expect(page.locator("#isOrganic")).not.toBeChecked();
  });
});
