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
