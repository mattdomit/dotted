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

// --- User ---

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
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
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
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
