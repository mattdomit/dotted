// --- Bid Scoring Weights ---
export const BID_SCORE_WEIGHTS = {
  price: 0.4,
  rating: 0.25,
  capacity: 0.2,
  prepTime: 0.15,
} as const;

// --- Supplier Matching Weights ---
export const SUPPLIER_MATCH_WEIGHTS = {
  price: 0.4,
  distance: 0.3,
  freshness: 0.2,
  rating: 0.1,
} as const;

// --- Default Daily Cycle Times (24h format) ---
export const DEFAULT_CYCLE_TIMES = {
  cycleStartHour: 6,
  votingStartHour: 6,
  votingEndHour: 12,
  biddingEndHour: 14,
  sourcingHour: 14,
  orderingStartHour: 17,
  orderingEndHour: 21,
  cycleCloseHour: 21,
} as const;

// --- Platform Constants ---
export const PLATFORM_FEE_PERCENT = 10;
export const MAX_DISHES_PER_CYCLE = 5;
export const MIN_DISHES_PER_CYCLE = 3;
export const VOTES_PER_USER_PER_CYCLE = 1;

// --- AI Config ---
export const AI_MODEL = "claude-sonnet-4-20250514";
export const AI_MAX_TOKENS = 4096;
