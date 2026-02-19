import { z } from "zod";
import { UserRole, FulfillmentType } from "./types";

// --- Auth Schemas ---

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// --- Vote Schema ---

export const castVoteSchema = z.object({
  dishId: z.string().uuid(),
  dailyCycleId: z.string().uuid(),
});

// --- Bid Schema ---

export const submitBidSchema = z.object({
  restaurantId: z.string().uuid(),
  dailyCycleId: z.string().uuid(),
  dishId: z.string().uuid(),
  pricePerPlate: z.number().positive().max(1000),
  prepTime: z.number().int().positive().max(480),
  maxCapacity: z.number().int().positive().max(10000),
  serviceFeeAccepted: z.boolean(),
});

// --- Inventory Schema ---

export const inventoryItemSchema = z.object({
  ingredientName: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  unit: z.string().min(1).max(50),
  pricePerUnit: z.number().positive(),
  quantityAvailable: z.number().positive(),
  harvestDate: z.string().datetime().optional(),
  isOrganic: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const updateInventorySchema = z.object({
  items: z.array(inventoryItemSchema).min(1).max(100),
});

// --- Order Schema ---

export const createOrderSchema = z.object({
  dailyCycleId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  fulfillmentType: z.nativeEnum(FulfillmentType),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "READY", "PICKED_UP", "DELIVERED"]),
});

// --- Restaurant Enrollment Schema ---

export const enrollRestaurantSchema = z.object({
  businessName: z.string().min(2).max(200),
  businessLicenseNumber: z.string().min(5).max(50),
  taxId: z.string().regex(/^\d{2}-\d{7}$/, "Must be EIN format: XX-XXXXXXX"),
  ownerFullName: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).regex(/^\d+$/, "Must contain only digits"),
  email: z.string().email(),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().length(2).regex(/^[A-Z]{2}$/, "Must be 2 uppercase letters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Must be 5 or 9 digit zip code"),
  cuisineTypes: z.array(z.string()).min(1).max(10),
  seatingCapacity: z.number().int().min(1).max(2000),
  kitchenCapacity: z.number().int().min(1).max(5000),
  healthPermitNumber: z.string().min(3).max(50),
  insurancePolicyNumber: z.string().min(5).max(100),
  yearsInOperation: z.number().int().min(0).max(200),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  zoneId: z.string().uuid(),
});

export type EnrollRestaurantInput = z.infer<typeof enrollRestaurantSchema>;

// --- Review Schema ---

export const createReviewSchema = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(2000),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// --- Zone Schema ---

export const joinZoneSchema = z.object({
  zoneId: z.string().uuid(),
});

// --- Type Exports ---

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type SubmitBidInput = z.infer<typeof submitBidSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
