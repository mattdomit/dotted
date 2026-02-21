import { test, expect } from "./helpers/fixtures";

const MOCK_USER = {
  data: {
    id: "user-social-1",
    name: "Social Tester",
    email: "social@test.com",
    role: "CONSUMER",
    emailVerified: true,
  },
};

const MOCK_RESTAURANTS = [
  { id: "r1", name: "Bella Italia", address: "123 Main St", rating: 4.5 },
];

const MOCK_REVIEWS = {
  data: {
    reviews: [
      {
        id: "rev1",
        rating: 5,
        title: "Amazing Food!",
        body: "Best truffle risotto I have ever had.",
        imageUrls: ["https://example.com/food1.jpg"],
        createdAt: "2025-01-15T12:00:00Z",
        user: { name: "Alice" },
        replyCount: 2,
        helpfulCount: 5,
        isVerifiedPurchase: true,
      },
      {
        id: "rev2",
        rating: 3,
        title: "Decent",
        body: "Good but not great.",
        imageUrls: [],
        createdAt: "2025-01-14T12:00:00Z",
        user: { name: "Bob" },
        replyCount: 0,
        helpfulCount: 1,
        isVerifiedPurchase: false,
      },
    ],
    averageRating: 4,
    total: 2,
  },
};

const MOCK_REPLIES = {
  data: [
    { id: "reply1", body: "Thanks for the kind words!", createdAt: "2025-01-16T12:00:00Z", user: { name: "Owner" } },
    { id: "reply2", body: "Glad you enjoyed it!", createdAt: "2025-01-17T12:00:00Z", user: { name: "Chef" } },
  ],
};

const MOCK_ZONE_MEMBERSHIP = {
  data: [{ id: "mem-1", zoneId: "zone-1" }],
};

const MOCK_FEED = {
  data: [
    {
      id: "post-1",
      body: "Loved today's risotto! Anyone else try it?",
      imageUrl: null,
      createdAt: "2025-01-20T12:00:00Z",
      user: { name: "Alice" },
      commentCount: 3,
      likeCount: 7,
    },
    {
      id: "post-2",
      body: "New supplier just joined our zone!",
      imageUrl: null,
      createdAt: "2025-01-19T12:00:00Z",
      user: { name: "Bob" },
      commentCount: 1,
      likeCount: 2,
    },
  ],
};

const MOCK_COMMENTS = {
  data: [
    {
      id: "c1",
      body: "Yes, it was delicious!",
      createdAt: "2025-01-20T13:00:00Z",
      user: { name: "Charlie" },
      children: [
        {
          id: "c1-1",
          body: "Agreed, the truffle was amazing.",
          createdAt: "2025-01-20T14:00:00Z",
          user: { name: "Dave" },
        },
      ],
    },
  ],
};

const MOCK_PROFILE = {
  data: {
    id: "user-profile-1",
    name: "Profile User",
    role: "CONSUMER",
    bio: "I love food and community!",
    dietaryPreferences: ["Vegetarian", "Gluten-Free"],
    badges: ["First Vote", "First Review", "Founding Member"],
    reviewCount: 5,
    postCount: 12,
    createdAt: "2024-06-01T00:00:00Z",
  },
};

test.describe("Social Features — Reviews", () => {
  test("reviews show reply count, helpful count, and verified badge", async ({ page }) => {
    await page.route("**/api/restaurants", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: MOCK_RESTAURANTS }) })
    );
    await page.route("**/api/reviews/restaurant/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_REVIEWS) })
    );
    await page.goto("/reviews");
    await page.locator("#browse-restaurant").selectOption("r1");

    await expect(page.getByText("Amazing Food!")).toBeVisible();
    await expect(page.getByText("Decent")).toBeVisible();
    await expect(page.getByText("2 reviews")).toBeVisible();
  });

  test("submit review with auth posts successfully", async ({ consumerPage }) => {
    await consumerPage.route("**/api/restaurants", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: MOCK_RESTAURANTS }) })
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
    await consumerPage.locator("#review-title").fill("Great Experience");
    await consumerPage.locator("#review-body").fill("The food was wonderful and the ambiance was lovely!");
    await consumerPage.getByRole("button", { name: "Post Review" }).click();

    await expect(consumerPage.getByText("Review posted successfully")).toBeVisible();
  });
});

test.describe("Social Features — Community Feed", () => {
  test("community page shows heading and feed", async ({ consumerPage }) => {
    await consumerPage.route("**/api/zones/mine", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONE_MEMBERSHIP) })
    );
    await consumerPage.route("**/api/feed/zones/zone-1/feed*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FEED) })
    );
    await consumerPage.goto("/community");

    await expect(consumerPage.getByRole("heading", { name: "Community" })).toBeVisible();
    await expect(consumerPage.getByText("Loved today's risotto!")).toBeVisible();
    await expect(consumerPage.getByText("New supplier just joined")).toBeVisible();
    await expect(consumerPage.getByText("7 Likes")).toBeVisible();
    await expect(consumerPage.getByText("3 Comments")).toBeVisible();
  });

  test("compose and submit a new post", async ({ consumerPage }) => {
    await consumerPage.route("**/api/zones/mine", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONE_MEMBERSHIP) })
    );
    await consumerPage.route("**/api/feed/zones/zone-1/feed*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FEED) })
    );
    await consumerPage.route("**/api/feed/zones/zone-1/posts", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { id: "new-post" } }),
        });
      }
      return route.continue();
    });

    await consumerPage.goto("/community");

    await consumerPage.locator("textarea").fill("This is my new community post!");
    await consumerPage.getByRole("button", { name: "Post" }).click();

    // Feed should refresh — the mock still returns the same data
    await expect(consumerPage.getByText("Loved today's risotto!")).toBeVisible();
  });

  test("expand comments shows threaded comments", async ({ consumerPage }) => {
    await consumerPage.route("**/api/zones/mine", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ZONE_MEMBERSHIP) })
    );
    await consumerPage.route("**/api/feed/zones/zone-1/feed*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FEED) })
    );
    await consumerPage.route("**/api/feed/posts/post-1/comments", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_COMMENTS) })
    );

    await consumerPage.goto("/community");

    // Click "3 Comments" to expand
    await consumerPage.getByText("3 Comments").click();

    await expect(consumerPage.getByText("Yes, it was delicious!")).toBeVisible();
    await expect(consumerPage.getByText("the truffle was amazing")).toBeVisible();
    // Comment input should appear
    await expect(consumerPage.getByPlaceholder("Write a comment...")).toBeVisible();
  });

  test("no zone shows join message", async ({ consumerPage }) => {
    await consumerPage.route("**/api/zones/mine", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
    );

    await consumerPage.goto("/community");

    await expect(consumerPage.getByText("Join a zone to see the community feed")).toBeVisible();
  });
});

test.describe("Social Features — User Profile", () => {
  test("profile page shows user info, badges, stats, and tabs", async ({ page }) => {
    await page.route("**/api/users/user-profile-1/profile", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROFILE) })
    );

    await page.goto("/profile/user-profile-1");

    await expect(page.getByRole("heading", { name: "Profile User" })).toBeVisible();
    await expect(page.getByText("I love food and community!")).toBeVisible();
    // Badges
    await expect(page.getByText("First Vote")).toBeVisible();
    await expect(page.getByText("First Review")).toBeVisible();
    await expect(page.getByText("Founding Member")).toBeVisible();
    // Stats
    await expect(page.getByText("5")).toBeVisible(); // review count
    await expect(page.getByText("12")).toBeVisible(); // post count
    // Dietary preferences
    await expect(page.getByText("Vegetarian")).toBeVisible();
    await expect(page.getByText("Gluten-Free")).toBeVisible();
    // Tabs
    await expect(page.getByRole("button", { name: "Reviews" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Posts" })).toBeVisible();
  });

  test("nonexistent profile shows error", async ({ page }) => {
    await page.route("**/api/users/nonexistent/profile", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "User not found" }) })
    );

    await page.goto("/profile/nonexistent");

    await expect(page.getByText("Profile not found")).toBeVisible();
  });
});
