import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  castVoteSchema,
  submitBidSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  enrollRestaurantSchema,
  createReviewSchema,
  updateInventorySchema,
  joinZoneSchema,
} from "@dotted/shared";
import { UserRole, FulfillmentType } from "@dotted/shared";
import { randomUUID } from "crypto";

describe("Validation Schemas", () => {
  describe("registerSchema", () => {
    const valid = { email: "user@test.com", password: "password123", name: "Test User", role: UserRole.CONSUMER };

    it("should accept valid input", () => {
      expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject invalid email", () => {
      expect(registerSchema.safeParse({ ...valid, email: "notanemail" }).success).toBe(false);
    });

    it("should reject short password (< 8 chars)", () => {
      expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    });

    it("should reject long password (> 128 chars)", () => {
      expect(registerSchema.safeParse({ ...valid, password: "a".repeat(129) }).success).toBe(false);
    });

    it("should reject short name (< 2 chars)", () => {
      expect(registerSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    });

    it("should accept all valid roles", () => {
      for (const role of Object.values(UserRole)) {
        expect(registerSchema.safeParse({ ...valid, role }).success).toBe(true);
      }
    });

    it("should reject invalid role", () => {
      expect(registerSchema.safeParse({ ...valid, role: "SUPERADMIN" }).success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid input", () => {
      expect(loginSchema.safeParse({ email: "user@test.com", password: "pass" }).success).toBe(true);
    });

    it("should reject missing email", () => {
      expect(loginSchema.safeParse({ password: "pass" }).success).toBe(false);
    });

    it("should reject missing password", () => {
      expect(loginSchema.safeParse({ email: "user@test.com" }).success).toBe(false);
    });
  });

  describe("castVoteSchema", () => {
    const valid = { dishId: randomUUID(), dailyCycleId: randomUUID() };

    it("should accept valid UUIDs", () => {
      expect(castVoteSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject non-UUID dishId", () => {
      expect(castVoteSchema.safeParse({ ...valid, dishId: "not-a-uuid" }).success).toBe(false);
    });

    it("should reject non-UUID dailyCycleId", () => {
      expect(castVoteSchema.safeParse({ ...valid, dailyCycleId: "abc" }).success).toBe(false);
    });
  });

  describe("submitBidSchema", () => {
    const valid = {
      restaurantId: randomUUID(),
      dailyCycleId: randomUUID(),
      dishId: randomUUID(),
      pricePerPlate: 15.5,
      prepTime: 30,
      maxCapacity: 100,
      serviceFeeAccepted: true,
    };

    it("should accept valid input", () => {
      expect(submitBidSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject non-positive price", () => {
      expect(submitBidSchema.safeParse({ ...valid, pricePerPlate: 0 }).success).toBe(false);
      expect(submitBidSchema.safeParse({ ...valid, pricePerPlate: -5 }).success).toBe(false);
    });

    it("should reject price above 1000", () => {
      expect(submitBidSchema.safeParse({ ...valid, pricePerPlate: 1001 }).success).toBe(false);
    });

    it("should reject non-integer prepTime", () => {
      expect(submitBidSchema.safeParse({ ...valid, prepTime: 30.5 }).success).toBe(false);
    });

    it("should reject prepTime above 480", () => {
      expect(submitBidSchema.safeParse({ ...valid, prepTime: 481 }).success).toBe(false);
    });

    it("should reject maxCapacity above 10000", () => {
      expect(submitBidSchema.safeParse({ ...valid, maxCapacity: 10001 }).success).toBe(false);
    });
  });

  describe("createOrderSchema", () => {
    const valid = {
      dailyCycleId: randomUUID(),
      restaurantId: randomUUID(),
      quantity: 2,
      fulfillmentType: FulfillmentType.PICKUP,
    };

    it("should accept valid input", () => {
      expect(createOrderSchema.safeParse(valid).success).toBe(true);
    });

    it("should accept DELIVERY fulfillment", () => {
      expect(createOrderSchema.safeParse({ ...valid, fulfillmentType: FulfillmentType.DELIVERY }).success).toBe(true);
    });

    it("should reject non-positive quantity", () => {
      expect(createOrderSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    });

    it("should reject quantity above 100", () => {
      expect(createOrderSchema.safeParse({ ...valid, quantity: 101 }).success).toBe(false);
    });
  });

  describe("updateOrderStatusSchema", () => {
    it("should accept CONFIRMED", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "CONFIRMED" }).success).toBe(true);
    });

    it("should accept READY", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "READY" }).success).toBe(true);
    });

    it("should accept PICKED_UP", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "PICKED_UP" }).success).toBe(true);
    });

    it("should accept DELIVERED", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "DELIVERED" }).success).toBe(true);
    });

    it("should reject PENDING (not in allowed enum)", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "PENDING" }).success).toBe(false);
    });

    it("should reject invalid status", () => {
      expect(updateOrderStatusSchema.safeParse({ status: "CANCELLED" }).success).toBe(false);
    });
  });

  describe("enrollRestaurantSchema", () => {
    const valid = {
      businessName: "Test Restaurant",
      businessLicenseNumber: "LIC12345",
      taxId: "12-3456789",
      ownerFullName: "John Doe",
      phone: "1234567890",
      email: "rest@test.com",
      address: "123 Main St",
      city: "Test City",
      state: "TC",
      zipCode: "12345",
      cuisineTypes: ["Italian"],
      seatingCapacity: 50,
      kitchenCapacity: 200,
      healthPermitNumber: "HP123",
      insurancePolicyNumber: "INS12345",
      yearsInOperation: 5,
      zoneId: randomUUID(),
    };

    it("should accept valid input", () => {
      expect(enrollRestaurantSchema.safeParse(valid).success).toBe(true);
    });

    it("should accept 9-digit zip code", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, zipCode: "12345-6789" }).success).toBe(true);
    });

    it("should reject invalid taxId format", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, taxId: "123456789" }).success).toBe(false);
      expect(enrollRestaurantSchema.safeParse({ ...valid, taxId: "1-23456789" }).success).toBe(false);
    });

    it("should reject lowercase state", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, state: "tc" }).success).toBe(false);
    });

    it("should reject state with wrong length", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, state: "TCA" }).success).toBe(false);
    });

    it("should reject non-digit phone", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, phone: "123-456-7890" }).success).toBe(false);
    });

    it("should accept optional website as empty string", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, website: "" }).success).toBe(true);
    });

    it("should accept optional website as valid URL", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, website: "https://test.com" }).success).toBe(true);
    });

    it("should reject invalid URL for website", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, website: "not-a-url" }).success).toBe(false);
    });

    it("should require at least 1 cuisine type", () => {
      expect(enrollRestaurantSchema.safeParse({ ...valid, cuisineTypes: [] }).success).toBe(false);
    });
  });

  describe("createReviewSchema", () => {
    const valid = {
      restaurantId: randomUUID(),
      rating: 4,
      title: "Great food",
      body: "Really enjoyed the meal, would order again!",
    };

    it("should accept valid input without orderId", () => {
      expect(createReviewSchema.safeParse(valid).success).toBe(true);
    });

    it("should accept valid input with orderId", () => {
      expect(createReviewSchema.safeParse({ ...valid, orderId: randomUUID() }).success).toBe(true);
    });

    it("should reject rating below 1", () => {
      expect(createReviewSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    });

    it("should reject rating above 5", () => {
      expect(createReviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    });

    it("should reject non-integer rating", () => {
      expect(createReviewSchema.safeParse({ ...valid, rating: 3.5 }).success).toBe(false);
    });

    it("should reject short title (< 3 chars)", () => {
      expect(createReviewSchema.safeParse({ ...valid, title: "Hi" }).success).toBe(false);
    });

    it("should reject short body (< 10 chars)", () => {
      expect(createReviewSchema.safeParse({ ...valid, body: "Good" }).success).toBe(false);
    });
  });

  describe("updateInventorySchema", () => {
    const validItem = {
      ingredientName: "Tomatoes",
      category: "Produce",
      unit: "kg",
      pricePerUnit: 3.5,
      quantityAvailable: 100,
    };

    it("should accept valid inventory items", () => {
      expect(updateInventorySchema.safeParse({ items: [validItem] }).success).toBe(true);
    });

    it("should reject empty items array", () => {
      expect(updateInventorySchema.safeParse({ items: [] }).success).toBe(false);
    });

    it("should accept items with optional fields", () => {
      expect(
        updateInventorySchema.safeParse({
          items: [{ ...validItem, isOrganic: true, harvestDate: "2025-01-01T00:00:00.000Z" }],
        }).success
      ).toBe(true);
    });

    it("should default isOrganic to false", () => {
      const result = updateInventorySchema.safeParse({ items: [validItem] });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items[0].isOrganic).toBe(false);
      }
    });
  });

  describe("joinZoneSchema", () => {
    it("should accept valid UUID", () => {
      expect(joinZoneSchema.safeParse({ zoneId: randomUUID() }).success).toBe(true);
    });

    it("should reject non-UUID", () => {
      expect(joinZoneSchema.safeParse({ zoneId: "not-a-uuid" }).success).toBe(false);
    });
  });
});
