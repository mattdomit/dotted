import { test, expect } from "./helpers/fixtures";

test.describe("Reviews Page", () => {
  test("heading and search form render", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: "Restaurant Reviews" })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter Restaurant ID/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("search nonexistent restaurant shows error", async ({ page }) => {
    await page.route("**/api/reviews/restaurant/**", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "Not found" }) })
    );
    await page.goto("/reviews");
    await page.getByPlaceholder(/Enter Restaurant ID/).fill("nonexistent-id");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Could not load reviews")).toBeVisible();
  });

  test("search valid restaurant shows review cards with ratings", async ({ page }) => {
    await page.route("**/api/reviews/restaurant/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            reviews: [
              {
                id: "r1",
                rating: 5,
                title: "Amazing Food!",
                body: "Best truffle risotto I have ever had.",
                createdAt: "2025-01-15T12:00:00Z",
                user: { name: "Alice" },
              },
              {
                id: "r2",
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
    await page.getByPlaceholder(/Enter Restaurant ID/).fill("valid-restaurant-id");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("Amazing Food!")).toBeVisible();
    await expect(page.getByText("Decent")).toBeVisible();
    await expect(page.getByText("2 reviews")).toBeVisible();
  });

  test("submit review without auth shows error", async ({ page }) => {
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Write a Review" }).click();

    await page.locator("#review-restaurantId").fill("some-id");
    await page.locator("#review-title").fill("Great Place");
    await page.locator("#review-body").fill("This is a wonderful restaurant with great food.");
    await page.getByRole("button", { name: "Post Review" }).click();

    await expect(page.getByText("You must be signed in to post a review")).toBeVisible();
  });

  test("submit review with auth shows success message", async ({ consumerPage }) => {
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

    await consumerPage.locator("#review-restaurantId").fill("some-restaurant-id");
    await consumerPage.locator("#review-title").fill("Excellent Dinner");
    await consumerPage.locator("#review-body").fill("The food was absolutely fantastic, would recommend!");
    await consumerPage.getByRole("button", { name: "Post Review" }).click();

    await expect(consumerPage.getByText("Review posted successfully")).toBeVisible();
  });
});
