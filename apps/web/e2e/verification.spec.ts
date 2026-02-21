import { test, expect } from "./helpers/fixtures";

const MOCK_USER_UNVERIFIED = {
  data: {
    id: "user-unv-1",
    name: "Unverified User",
    email: "unverified@test.com",
    role: "CONSUMER",
    emailVerified: false,
  },
};

const MOCK_USER_VERIFIED = {
  data: {
    id: "user-v-1",
    name: "Verified User",
    email: "verified@test.com",
    role: "CONSUMER",
    emailVerified: true,
  },
};

test.describe("Verification Page", () => {
  test("heading and 6-digit input render", async ({ page }) => {
    // Inject fake auth with unverified user
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-unverified-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.goto("/verify");

    await expect(page.getByRole("heading", { name: "Verify Your Account" })).toBeVisible();
    await expect(page.getByText("Enter the 6-digit code")).toBeVisible();
    // 6 code inputs
    const inputs = page.locator("input[inputmode='numeric']");
    await expect(inputs).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();
    await expect(page.getByText("Resend code")).toBeVisible();
  });

  test("email and SMS tabs switch", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.goto("/verify");

    // Default shows email tab active
    await expect(page.getByText("sent to your email")).toBeVisible();

    // Switch to SMS
    await page.getByRole("button", { name: "SMS" }).click();
    await expect(page.getByText("sent to your phone")).toBeVisible();

    // Switch back to Email
    await page.getByRole("button", { name: "Email" }).click();
    await expect(page.getByText("sent to your email")).toBeVisible();
  });

  test("submit incomplete code shows error", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.goto("/verify");

    // Fill only 3 digits
    const inputs = page.locator("input[inputmode='numeric']");
    await inputs.nth(0).fill("1");
    await inputs.nth(1).fill("2");
    await inputs.nth(2).fill("3");

    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("Please enter all 6 digits")).toBeVisible();
  });

  test("submit valid code calls verify API and redirects", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.route("**/api/auth/verify", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { token: "new-verified-token" } }),
      })
    );
    await page.goto("/verify");

    // Fill all 6 digits
    const inputs = page.locator("input[inputmode='numeric']");
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill("0");
    }

    await page.getByRole("button", { name: "Verify" }).click();
    // Should attempt to redirect to home
    await page.waitForURL("/");
  });

  test("resend code button triggers cooldown", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.route("**/api/auth/resend-verification", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );
    await page.goto("/verify");

    await page.getByText("Resend code").click();
    // Should show cooldown
    await expect(page.getByText(/Resend in \d+s/)).toBeVisible();
  });

  test("verify API error shows error message", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_UNVERIFIED),
      })
    );
    await page.route("**/api/auth/verify", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid or expired code" }),
      })
    );
    await page.goto("/verify");

    const inputs = page.locator("input[inputmode='numeric']");
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill("9");
    }

    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("Invalid or expired code")).toBeVisible();
  });
});
