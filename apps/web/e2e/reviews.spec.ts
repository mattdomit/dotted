import { test, expect } from "./helpers/fixtures";

const MOCK_RESTAURANTS = [
  { id: "r1", name: "Bella Italia", address: "123 Main St", rating: 4.5 },
  { id: "r2", name: "Sushi Palace", address: "456 Oak Ave", rating: 4.0 },
];

test.describe("Reviews Page", () => {
  test("heading and browse dropdown render", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: "Restaurant Reviews" })).toBeVisible();
    await expect(page.locator("#browse-restaurant")).toBeVisible();
    await expect(page.getByRole("button", { name: "Write a Review" })).toBeVisible();
  });

  test("select restaurant with no reviews shows empty state", async ({ page }) => {
    await page.route("**/api/restaurants", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_RESTAURANTS }),
      })
    );
    await page.route("**/api/reviews/restaurant/**", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await page.goto("/reviews");
    await page.locator("#browse-restaurant").selectOption("r1");
    await expect(page.getByText("Could not load reviews")).toBeVisible();
  });

  test("select valid restaurant shows review cards with ratings", async ({ page }) => {
    await page.route("**/api/restaurants", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_RESTAURANTS }),
      })
    );
    await page.route("**/api/reviews/restaurant/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            reviews: [
              {
                id: "rev1",
                rating: 5,
                title: "Amazing Food!",
                body: "Best truffle risotto I have ever had.",
                createdAt: "2025-01-15T12:00:00Z",
                user: { name: "Alice" },
              },
              {
                id: "rev2",
                rating: 3,
                title: "Decent",
                body: "Good but not great.",
                createdAt: "2025-01-14T12:00:00Z",
                user: { name: "Bob" },
              },
            ],
            averageRating: 4,
            total: 2,
          },
        }),
      })
    );
    await page.goto("/reviews");
    await page.locator("#browse-restaurant").selectOption("r1");

    await expect(page.getByText("Amazing Food!")).toBeVisible();
    await expect(page.getByText("Decent")).toBeVisible();
    await expect(page.getByText("2 reviews")).toBeVisible();
  });

  test("submit review without auth shows error", async ({ page }) => {
    await page.route("**/api/restaurants", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_RESTAURANTS }),
      })
    );
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Write a Review" }).click();

    await page.locator("#review-restaurantId").selectOption("r1");
    await page.locator("#review-title").fill("Great Place");
    await page.locator("#review-body").fill("This is a wonderful restaurant with great food.");
    await page.getByRole("button", { name: "Post Review" }).click();

    await expect(page.getByText("You must be signed in to post a review")).toBeVisible();
  });

  test("submit review with auth shows success message", async ({ consumerPage }) => {
    await consumerPage.route("**/api/restaurants", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_RESTAURANTS }),
      })
    );
    await consumerPage.route("**/api/reviews", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { id: "new-review" } }),
        });
      }
      return route.continue();
    });

    await consumerPage.goto("/reviews");
    await consumerPage.getByRole("button", { name: "Write a Review" }).click();

    await consumerPage.locator("#review-restaurantId").selectOption("r1");
    await consumerPage.locator("#review-title").fill("Excellent Dinner");
    await consumerPage.locator("#review-body").fill("The food was absolutely fantastic, would recommend!");
    await consumerPage.getByRole("button", { name: "Post Review" }).click();

    await expect(consumerPage.getByText("Review posted successfully")).toBeVisible();
  });
});
