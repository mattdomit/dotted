import { test, expect } from "./helpers/fixtures";

const MOCK_RESTAURANT = {
  data: {
    id: "rest-001",
    name: "Bay Bites Kitchen",
    address: "123 Market St, SF",
    capacity: 80,
    isVerified: true,
    cuisineTypes: ["Italian", "American"],
    kitchenCapacity: 100,
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    zoneId: "zone-1",
  },
};

const MOCK_CYCLE = {
  data: {
    id: "cycle-bid-1",
    status: "BIDDING",
    winningDishId: "dish-win-1",
    dishes: [{ id: "dish-win-1", name: "Truffle Risotto" }],
  },
};

test.describe("Bids Page", () => {
  test('no auth token shows "Sign In Required" heading', async ({ page }) => {
    await page.goto("/bids");
    await expect(page.getByRole("heading", { name: "Sign In Required" })).toBeVisible();
  });

  test('auth but no restaurant shows "Enrollment Required" + enroll link', async ({
    restaurantPage,
  }) => {
    await restaurantPage.route("**/api/restaurants/mine", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await restaurantPage.goto("/bids");

    await expect(
      restaurantPage.getByRole("heading", { name: "Enrollment Required" })
    ).toBeVisible();
    await expect(
      restaurantPage.getByRole("link", { name: "Enroll Your Restaurant" })
    ).toBeVisible();
  });

  test("auth with restaurant shows restaurant info + bid form fields", async ({
    restaurantPage,
  }) => {
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
        body: JSON.stringify(MOCK_CYCLE),
      })
    );
    await restaurantPage.goto("/bids");

    await expect(restaurantPage.getByText("Bay Bites Kitchen")).toBeVisible();
    await expect(restaurantPage.getByText("Verified")).toBeVisible();
    await expect(restaurantPage.locator("#pricePerPlate")).toBeVisible();
    await expect(restaurantPage.locator("#prepTime")).toBeVisible();
    await expect(restaurantPage.locator("#maxCapacity")).toBeVisible();
  });

  test('bid form submission shows "Bid Submitted!" success state', async ({
    restaurantPage,
  }) => {
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
        body: JSON.stringify(MOCK_CYCLE),
      })
    );
    await restaurantPage.route("**/api/bids", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: "bid-1" } }),
      })
    );
    await restaurantPage.goto("/bids");

    await restaurantPage.locator("#pricePerPlate").fill("12.50");
    await restaurantPage.locator("#prepTime").fill("45");
    await restaurantPage.locator("#maxCapacity").fill("50");
    await restaurantPage.getByRole("button", { name: "Submit Bid" }).click();

    await expect(restaurantPage.getByText("Bid Submitted!")).toBeVisible();
  });

  test('"Enroll Your Restaurant" link navigates to /enroll', async ({
    restaurantPage,
  }) => {
    await restaurantPage.route("**/api/restaurants/mine", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await restaurantPage.goto("/bids");

    await restaurantPage.getByRole("link", { name: "Enroll Your Restaurant" }).click();
    await expect(restaurantPage).toHaveURL("/enroll");
  });
});
