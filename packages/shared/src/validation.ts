import { z } from "zod";
import { UserRole, FulfillmentType, DeliveryStatus } from "./types";

// --- Auth Schemas ---

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole),
  phoneNumber: z.string().min(10).max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// --- Verification Schemas ---

export const verifyCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
  type: z.enum(["EMAIL", "SMS"]),
});

export const resendVerificationSchema = z.object({
  type: z.enum(["EMAIL", "SMS"]),
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
  phone: z.string().min(10).max(20),
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

// --- Review Schemas ---

export const createReviewSchema = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(2000),
  imageUrls: z.array(z.string().url()).max(3).default([]),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const createReviewReplySchema = z.object({
  body: z.string().min(1).max(1000),
});

export const reviewVoteSchema = z.object({
  helpful: z.boolean(),
});

// --- Community Schemas ---

export const createZonePostSchema = z.object({
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

export const createPostCommentSchema = z.object({
  body: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

// --- Delivery Schema ---

export const updateDeliverySchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  note: z.string().max(500).optional(),
  estimatedArrival: z.string().datetime().optional(),
});

// --- User Profile Schemas ---

export const updateDietaryPreferencesSchema = z.object({
  dietaryPreferences: z.array(z.string().max(50)).max(20),
});

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  phoneNumber: z.string().min(10).max(20).optional(),
});

// --- Zone Config Schema ---

export const updateZoneConfigSchema = z.object({
  maxPricePerPlate: z.number().positive().max(200).optional(),
  preferredCuisines: z.array(z.string().max(50)).max(20).optional(),
});

// --- Zone Schema ---

export const joinZoneSchema = z.object({
  zoneId: z.string().uuid(),
});

// --- v2.0: Quality Score Schema ---

export const submitQualityScoreSchema = z.object({
  orderId: z.string().uuid(),
  taste: z.number().int().min(1).max(5),
  freshness: z.number().int().min(1).max(5),
  presentation: z.number().int().min(1).max(5),
  portion: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// --- v2.0: Subscription Schema ---

export const createSubscriptionSchema = z.object({
  tier: z.enum(["PLUS", "PREMIUM"]),
});

// --- v2.0: Optimization Weights Schema ---

export const updateOptimizationWeightsSchema = z.object({
  quality: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  variety: z.number().min(0).max(1),
  cost: z.number().min(0).max(1),
  waste: z.number().min(0).max(1),
}).refine(
  (data) => {
    const sum = data.quality + data.freshness + data.variety + data.cost + data.waste;
    return Math.abs(sum - 1.0) < 0.01;
  },
  { message: "Weights must sum to 1.0" }
);

// --- v2.0: Restaurant Capabilities Schema ---

export const updateRestaurantCapabilitiesSchema = z.object({
  equipmentTags: z.array(z.string().max(50)).max(20).optional(),
  maxConcurrentOrders: z.number().int().positive().max(1000).optional(),
});

// --- Type Exports ---

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type SubmitBidInput = z.infer<typeof submitBidSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
export type UpdateDietaryPreferencesInput = z.infer<typeof updateDietaryPreferencesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SubmitQualityScoreInput = z.infer<typeof submitQualityScoreSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateOptimizationWeightsInput = z.infer<typeof updateOptimizationWeightsSchema>;
export type UpdateRestaurantCapabilitiesInput = z.infer<typeof updateRestaurantCapabilitiesSchema>;
