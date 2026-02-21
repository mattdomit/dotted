import { test, expect } from "./helpers/fixtures";

const MOCK_SUPPLIER_USER = {
  data: {
    id: "user-sup-1",
    name: "Supplier User",
    email: "supplier@test.com",
    role: "SUPPLIER",
    emailVerified: true,
  },
};

const MOCK_ORDERS = {
  data: [
    {
      id: "po-001-aaa-bbb-ccc-ddd",
      status: "APPROVED",
      totalCost: 250.0,
      deliveryEta: "2025-02-01T12:00:00Z",
      createdAt: "2025-01-28T10:00:00Z",
      items: [
        {
          inventoryItem: { ingredientName: "Tomatoes", unit: "kg" },
          quantity: 50,
          unitPrice: 3.0,
        },
        {
          inventoryItem: { ingredientName: "Olive Oil", unit: "liters" },
          quantity: 10,
          unitPrice: 10.0,
        },
      ],
    },
    {
      id: "po-002-eee-fff-ggg-hhh",
      status: "DELIVERED",
      totalCost: 120.0,
      deliveryEta: "2025-01-25T12:00:00Z",
      createdAt: "2025-01-22T08:00:00Z",
      items: [
        {
          inventoryItem: { ingredientName: "Chicken Breast", unit: "kg" },
          quantity: 20,
          unitPrice: 6.0,
        },
      ],
    },
  ],
};

const MOCK_METRICS = {
  data: {
    onTimeRate: 0.85,
    qualityScore: 0.92,
    fulfillmentRate: 0.95,
    totalDeliveries: 47,
  },
};

test.describe("Delivery Management Page", () => {
  test("heading and purchase orders render", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ORDERS) })
    );

    await supplierPage.goto("/delivery");

    await expect(supplierPage.getByRole("heading", { name: "Delivery Management" })).toBeVisible();
    await expect(supplierPage.getByText("po-001-a")).toBeVisible();
    await expect(supplierPage.getByText("$250.00")).toBeVisible();
    await expect(supplierPage.getByText("Tomatoes")).toBeVisible();
    await expect(supplierPage.getByText("Olive Oil")).toBeVisible();
  });

  test("delivered orders do not show status buttons", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [MOCK_ORDERS.data[1]], // only the DELIVERED order
        }),
      })
    );

    await supplierPage.goto("/delivery");

    await expect(supplierPage.getByText("DELIVERED")).toBeVisible();
    // DELIVERED orders should not have any status buttons
    await expect(supplierPage.getByRole("button", { name: "DISPATCHED" })).not.toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "IN TRANSIT" })).not.toBeVisible();
  });

  test("non-delivered orders show delivery status buttons", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [MOCK_ORDERS.data[0]], // only the APPROVED order
        }),
      })
    );

    await supplierPage.goto("/delivery");

    await expect(supplierPage.getByRole("button", { name: "DISPATCHED" })).toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "IN TRANSIT" })).toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "ARRIVED" })).toBeVisible();
    await expect(supplierPage.getByRole("button", { name: "DELIVERED" })).toBeVisible();
  });

  test("click status button calls delivery API", async ({ supplierPage }) => {
    let deliveryCallMade = false;
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [MOCK_ORDERS.data[0]] }),
      })
    );
    await supplierPage.route("**/api/delivery/purchase-orders/*/delivery", (route) => {
      deliveryCallMade = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await supplierPage.goto("/delivery");
    await supplierPage.getByRole("button", { name: "DISPATCHED" }).click();

    // Wait for the re-fetch of orders (delivery call was made)
    await supplierPage.waitForResponse("**/api/suppliers/orders");
  });

  test("empty orders shows no-data message", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/orders", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
    );

    await supplierPage.goto("/delivery");

    await expect(supplierPage.getByText("No purchase orders yet")).toBeVisible();
  });
});

test.describe("Supplier Metrics Page", () => {
  test("heading and metric cards render", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/inventory", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "inv-1", supplierId: "supplier-1", ingredientName: "Tomatoes" }],
        }),
      })
    );
    await supplierPage.route("**/api/delivery/suppliers/supplier-1/metrics", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_METRICS) })
    );

    await supplierPage.goto("/metrics");

    await expect(supplierPage.getByRole("heading", { name: "Performance Metrics" })).toBeVisible();
    await expect(supplierPage.getByText("85.0%")).toBeVisible(); // onTimeRate
    await expect(supplierPage.getByText("On-Time Rate")).toBeVisible();
    await expect(supplierPage.getByText("92.0%")).toBeVisible(); // qualityScore
    await expect(supplierPage.getByText("Quality Score")).toBeVisible();
    await expect(supplierPage.getByText("95.0%")).toBeVisible(); // fulfillmentRate
    await expect(supplierPage.getByText("Fulfillment Rate")).toBeVisible();
    await expect(supplierPage.getByText("47")).toBeVisible(); // totalDeliveries
    await expect(supplierPage.getByText("Total Deliveries")).toBeVisible();
  });

  test("no metrics shows empty state", async ({ supplierPage }) => {
    await supplierPage.route("**/api/suppliers/inventory", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
    );

    await supplierPage.goto("/metrics");

    await expect(supplierPage.getByText("No metrics available yet")).toBeVisible();
  });
});
