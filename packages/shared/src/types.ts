// ============================================
// Dotted — Shared TypeScript Types
// ============================================

// --- Enums ---

export enum UserRole {
  CONSUMER = "CONSUMER",
  RESTAURANT_OWNER = "RESTAURANT_OWNER",
  SUPPLIER = "SUPPLIER",
  ADMIN = "ADMIN",
}

export enum CycleStatus {
  SUGGESTING = "SUGGESTING",
  VOTING = "VOTING",
  BIDDING = "BIDDING",
  SOURCING = "SOURCING",
  ORDERING = "ORDERING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum BidStatus {
  PENDING = "PENDING",
  WON = "WON",
  LOST = "LOST",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  READY = "READY",
  PICKED_UP = "PICKED_UP",
  DELIVERED = "DELIVERED",
}

export enum FulfillmentType {
  PICKUP = "PICKUP",
  DELIVERY = "DELIVERY",
}

export enum PurchaseOrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
}

export enum VerificationType {
  EMAIL = "EMAIL",
  SMS = "SMS",
}

export enum DeliveryStatus {
  DISPATCHED = "DISPATCHED",
  IN_TRANSIT = "IN_TRANSIT",
  ARRIVED = "ARRIVED",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
}

// --- User ---

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  dietaryPreferences: string[];
  bio?: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  dietaryPreferences: string[];
  badges: string[];
  reviewCount: number;
  postCount: number;
  createdAt: Date;
}

// --- Zone ---

export interface Zone {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  isActive: boolean;
  dailyCycleConfig: DailyCycleConfig;
  maxPricePerPlate?: number;
  preferredCuisines: string[];
}

export interface DailyCycleConfig {
  votingStartHour: number;
  votingEndHour: number;
  biddingEndHour: number;
  orderingStartHour: number;
  orderingEndHour: number;
}

// --- Daily Cycle ---

export interface DailyCycle {
  id: string;
  zoneId: string;
  date: string;
  status: CycleStatus;
  winningDishId?: string;
  winningBidId?: string;
  createdAt: Date;
}

// --- Dish ---

export interface Dish {
  id: string;
  dailyCycleId: string;
  name: string;
  description: string;
  cuisine: string;
  imageUrl?: string;
  recipeSpec: RecipeSpec;
  estimatedCost: number;
  voteCount: number;
  aiPromptUsed?: string;
}

export interface RecipeSpec {
  servings: number;
  prepTime: number;
  cookTime: number;
  instructions: string[];
  tags: string[];
}

// --- Ingredient ---

export interface Ingredient {
  id: string;
  dishId: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  preferredSupplierId?: string;
  substitutes: string[];
}

// --- Vote ---

export interface Vote {
  id: string;
  userId: string;
  dishId: string;
  dailyCycleId: string;
  createdAt: Date;
}

// --- Restaurant ---

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  rating: number;
  capacity: number;
  description?: string;
  imageUrl?: string;
  isVerified: boolean;
  zoneId: string;
  businessLicenseNumber?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cuisineTypes?: string[];
  kitchenCapacity?: number;
  healthPermitNumber?: string;
  insurancePolicyNumber?: string;
  yearsInOperation?: number;
  website?: string;
}

// --- Bid ---

export interface Bid {
  id: string;
  restaurantId: string;
  dailyCycleId: string;
  dishId: string;
  pricePerPlate: number;
  prepTime: number;
  maxCapacity: number;
  serviceFeeAccepted: boolean;
  score?: number;
  status: BidStatus;
  createdAt: Date;
}

// --- Supplier ---

export interface Supplier {
  id: string;
  ownerId: string;
  businessName: string;
  address: string;
  certifications: string[];
  rating: number;
  isVerified: boolean;
  zoneId: string;
  onTimeRate: number;
  qualityScore: number;
  fulfillmentRate: number;
}

export interface SupplierMetrics {
  onTimeRate: number;
  qualityScore: number;
  fulfillmentRate: number;
  totalDeliveries: number;
}

export interface SupplierInventory {
  id: string;
  supplierId: string;
  ingredientName: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  quantityAvailable: number;
  harvestDate?: Date;
  isOrganic: boolean;
  expiresAt?: Date;
  updatedAt: Date;
}

// --- Purchase Order ---

export interface PurchaseOrder {
  id: string;
  dailyCycleId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  totalCost: number;
  deliveryEta?: Date;
  deliveryNotes?: string;
  actualDeliveryTime?: Date;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
}

// --- Delivery Tracking ---

export interface DeliveryTracking {
  id: string;
  purchaseOrderId: string;
  status: DeliveryStatus;
  latitude?: number;
  longitude?: number;
  note?: string;
  estimatedArrival?: Date;
  createdAt: Date;
}

// --- Order ---

export interface Order {
  id: string;
  userId: string;
  dailyCycleId: string;
  restaurantId: string;
  quantity: number;
  totalPrice: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  stripePaymentId?: string;
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  dishId: string;
  quantity: number;
  price: number;
}

// --- Review ---

export interface Review {
  id: string;
  userId: string;
  restaurantId: string;
  orderId?: string;
  rating: number;
  title: string;
  body: string;
  imageUrls: string[];
  createdAt: Date;
  user?: { name: string; avatarUrl?: string };
  restaurant?: { name: string };
  replyCount?: number;
  helpfulCount?: number;
  isVerifiedPurchase?: boolean;
}

export interface ReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  body: string;
  createdAt: Date;
  user?: { name: string; avatarUrl?: string };
}

export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  helpful: boolean;
}

// --- Community ---

export interface ZonePost {
  id: string;
  zoneId: string;
  userId: string;
  body: string;
  imageUrl?: string;
  createdAt: Date;
  user?: { name: string; avatarUrl?: string };
  commentCount?: number;
  likeCount?: number;
  liked?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  parentId?: string;
  createdAt: Date;
  user?: { name: string; avatarUrl?: string };
  children?: PostComment[];
}

// --- Verification ---

export interface VerificationCode {
  id: string;
  userId: string;
  code: string;
  type: VerificationType;
  expiresAt: Date;
  verifiedAt?: Date;
}

// --- AI Types ---

export interface DishSuggestion {
  name: string;
  description: string;
  cuisine: string;
  recipeSpec: RecipeSpec;
  estimatedCost: number;
  ingredients: IngredientSuggestion[];
  tags: string[];
}

export interface IngredientSuggestion {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  substitutes: string[];
}

export interface SupplierMatch {
  ingredientName: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  quantity: number;
  score: number;
}

// --- Socket Events ---

export enum SocketEvent {
  VOTE_UPDATE = "vote:update",
  BID_UPDATE = "bid:update",
  CYCLE_STATUS_CHANGE = "cycle:status",
  ORDER_STATUS_CHANGE = "order:status",
  DELIVERY_UPDATE = "delivery:update",
  NOTIFICATION = "notification",
}

export interface VoteUpdate {
  cycleId: string;
  dishId: string;
  voteCount: number;
  totalVotes: number;
}

export interface BidUpdate {
  cycleId: string;
  bidCount: number;
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
