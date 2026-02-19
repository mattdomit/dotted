import { test, expect } from "./helpers/fixtures";

test.describe("Enroll Page", () => {
  test("all 6 form sections render", async ({ page }) => {
    await page.goto("/enroll");

    await expect(page.getByRole("heading", { name: "Restaurant Enrollment" })).toBeVisible();
    await expect(page.getByText("Business Identity")).toBeVisible();
    await expect(page.getByText("Contact Information")).toBeVisible();
    await expect(page.getByText("Location")).toBeVisible();
    await expect(page.getByText("Kitchen Details")).toBeVisible();
    await expect(page.getByText("Compliance & Licensing")).toBeVisible();
    await expect(page.getByText("About Your Restaurant")).toBeVisible();
  });

  test("submit without auth shows sign-in error", async ({ page }) => {
    await page.goto("/enroll");

    // Fill required fields minimally
    await page.locator("#businessName").fill("Test Kitchen");
    await page.locator("#businessLicenseNumber").fill("BL-999");
    await page.locator("#taxId").fill("99-9999999");
    await page.locator("#yearsInOperation").fill("5");
    await page.locator("#ownerFullName").fill("Test Owner");
    await page.locator("#phone").fill("5551234567");
    await page.locator("#email").fill("test@kitchen.com");
    await page.locator("#address").fill("123 Test St");
    await page.locator("#city").fill("San Francisco");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zipCode").fill("94102");
    await page.locator("#seatingCapacity").fill("50");
    await page.locator("#kitchenCapacity").fill("100");
    await page.locator("#healthPermitNumber").fill("HP-123");
    await page.locator("#insurancePolicyNumber").fill("INS-456");
    await page.locator("#zoneId").fill("some-zone-id");

    await page.getByRole("button", { name: "Complete Enrollment" }).click();
    await expect(page.getByText("You must be signed in to enroll")).toBeVisible();
  });

  test("full form fill with auth redirects to /bids", async ({ restaurantPage }) => {
    await restaurantPage.route("**/api/restaurants/enroll", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: "new-restaurant" } }),
      })
    );

    await restaurantPage.goto("/enroll");

    await restaurantPage.locator("#businessName").fill("E2E Kitchen");
    await restaurantPage.locator("#businessLicenseNumber").fill("BL-E2E");
    await restaurantPage.locator("#taxId").fill("12-3456789");
    await restaurantPage.locator("#yearsInOperation").fill("3");
    await restaurantPage.locator("#ownerFullName").fill("E2E Owner");
    await restaurantPage.locator("#phone").fill("5559876543");
    await restaurantPage.locator("#email").fill("e2e@kitchen.com");
    await restaurantPage.locator("#address").fill("456 E2E Ave");
    await restaurantPage.locator("#city").fill("Austin");
    await restaurantPage.locator("#state").selectOption("TX");
    await restaurantPage.locator("#zipCode").fill("78701");
    await restaurantPage.locator("#seatingCapacity").fill("80");
    await restaurantPage.locator("#kitchenCapacity").fill("150");
    await restaurantPage.locator("#healthPermitNumber").fill("HP-E2E");
    await restaurantPage.locator("#insurancePolicyNumber").fill("INS-E2E");
    await restaurantPage.locator("#zoneId").fill("demo-zone-id");

    await restaurantPage.getByRole("button", { name: "Complete Enrollment" }).click();
    await expect(restaurantPage).toHaveURL("/bids");
  });

  test("cuisine type checkboxes toggle on/off with visual feedback", async ({ page }) => {
    await page.goto("/enroll");

    const italian = page.getByText("Italian", { exact: true }).locator(".."); // the label wrapper
    await expect(italian).not.toHaveClass(/border-primary/);

    await page.getByText("Italian", { exact: true }).click();
    await expect(italian).toHaveClass(/border-primary/);

    await page.getByText("Italian", { exact: true }).click();
    await expect(italian).not.toHaveClass(/border-primary/);
  });

  test("API returns validation error displayed inline", async ({ restaurantPage }) => {
    await restaurantPage.route("**/api/restaurants/enroll", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Business name is required" }),
      })
    );

    await restaurantPage.goto("/enroll");

    // Fill all fields
    await restaurantPage.locator("#businessName").fill("X");
    await restaurantPage.locator("#businessLicenseNumber").fill("BL-1");
    await restaurantPage.locator("#taxId").fill("11-1111111");
    await restaurantPage.locator("#yearsInOperation").fill("1");
    await restaurantPage.locator("#ownerFullName").fill("Owner");
    await restaurantPage.locator("#phone").fill("5550000000");
    await restaurantPage.locator("#email").fill("x@x.com");
    await restaurantPage.locator("#address").fill("1 St");
    await restaurantPage.locator("#city").fill("City");
    await restaurantPage.locator("#state").selectOption("TX");
    await restaurantPage.locator("#zipCode").fill("00000");
    await restaurantPage.locator("#seatingCapacity").fill("10");
    await restaurantPage.locator("#kitchenCapacity").fill("10");
    await restaurantPage.locator("#healthPermitNumber").fill("HP-1");
    await restaurantPage.locator("#insurancePolicyNumber").fill("INS-1");
    await restaurantPage.locator("#zoneId").fill("zone-1");

    await restaurantPage.getByRole("button", { name: "Complete Enrollment" }).click();
    await expect(restaurantPage.getByText("Business name is required")).toBeVisible();
  });
});
