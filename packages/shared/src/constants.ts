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

// --- Verification ---
export const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

// --- Dietary Options ---
export const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "Pescatarian",
  "Keto",
  "Low-Sodium",
  "Low-Sugar",
  "Paleo",
] as const;

// --- Logistics ---
export const LOW_STOCK_THRESHOLD = 10;
export const MAX_REVIEW_IMAGES = 3;

// --- Badges ---
export const BADGES = {
  first_vote: { name: "First Vote", description: "Cast your first vote" },
  first_review: { name: "First Review", description: "Wrote your first review" },
  ten_reviews: { name: "Review Pro", description: "Wrote 10 reviews" },
  founding_member: { name: "Founding Member", description: "Joined within the first month" },
  helpful_reviewer: { name: "Helpful Reviewer", description: "Received 10 helpful votes" },
  community_contributor: { name: "Community Star", description: "Created 10 community posts" },
} as const;

// --- v2.0: Extended Badges ---
export const BADGES_V2 = {
  ...BADGES,
  five_day_streak: { name: "On Fire", description: "5-day activity streak" },
  quality_scorer: { name: "Quality Judge", description: "Submitted 10 quality scores" },
  top_voter: { name: "Top Voter", description: "Voted in 20 cycles" },
  premium_member: { name: "Premium Member", description: "Subscribed to Plus or Premium" },
  variety_explorer: { name: "Variety Explorer", description: "Voted for 10 different cuisines" },
} as const;

// --- v2.0: Optimization Weights ---
export const DEFAULT_OPTIMIZATION_WEIGHTS = {
  quality: 0.30,
  freshness: 0.25,
  variety: 0.20,
  cost: 0.15,
  waste: 0.10,
} as const;

// --- v2.0: Subscription Tiers ---
export const SUBSCRIPTION_TIERS = {
  FREE: {
    votesPerCycle: 1,
    maxOrdersPerDay: 2,
    features: ["basic_voting", "order_history"],
    priceMonthly: 0,
  },
  PLUS: {
    votesPerCycle: 3,
    maxOrdersPerDay: 5,
    features: ["basic_voting", "order_history", "quality_scoring", "achievements", "priority_ordering"],
    priceMonthly: 9.99,
  },
  PREMIUM: {
    votesPerCycle: 5,
    maxOrdersPerDay: 10,
    features: ["basic_voting", "order_history", "quality_scoring", "achievements", "priority_ordering", "personalized_ranking", "analytics_access", "early_access"],
    priceMonthly: 19.99,
  },
} as const;

// --- v2.0: Partner Tiers ---
export const PARTNER_TIERS = {
  STANDARD: { commissionRate: 0.10, label: "Standard" },
  SILVER: { commissionRate: 0.08, label: "Silver" },
  GOLD: { commissionRate: 0.06, label: "Gold" },
  PLATINUM: { commissionRate: 0.04, label: "Platinum" },
} as const;

// --- v2.0: Quality Dimensions ---
export const QUALITY_DIMENSIONS = ["taste", "freshness", "presentation", "portion"] as const;

// --- v2.0: Equipment Tags ---
export const EQUIPMENT_TAGS = [
  "oven",
  "grill",
  "fryer",
  "steamer",
  "wok",
  "tandoor",
  "smoker",
  "pizza_oven",
  "sous_vide",
  "mixer",
  "blast_chiller",
] as const;

// --- v2.0: Activity Levels ---
export const ACTIVITY_LEVELS = {
  LOW: {
    votingHours: 8,
    biddingHours: 3,
    sourcingHours: 4,
    label: "Low Activity",
  },
  MEDIUM: {
    votingHours: 6,
    biddingHours: 2,
    sourcingHours: 3,
    label: "Medium Activity",
  },
  HIGH: {
    votingHours: 4,
    biddingHours: 1,
    sourcingHours: 2,
    label: "High Activity",
  },
} as const;

// --- Seasonal Ingredients (month-indexed, 0 = January) ---
export const SEASONAL_INGREDIENTS: string[][] = [
  // January
  ["Citrus", "Kale", "Leeks", "Sweet Potatoes", "Turnips", "Brussels Sprouts"],
  // February
  ["Blood Oranges", "Cabbage", "Parsnips", "Rutabaga", "Winter Squash"],
  // March
  ["Artichokes", "Asparagus", "Broccoli", "Spinach", "Spring Onions"],
  // April
  ["Peas", "Radishes", "Rhubarb", "Strawberries", "Watercress"],
  // May
  ["Apricots", "Cherries", "Green Beans", "Lettuce", "Zucchini"],
  // June
  ["Blueberries", "Corn", "Cucumbers", "Peaches", "Tomatoes"],
  // July
  ["Blackberries", "Eggplant", "Figs", "Melons", "Peppers"],
  // August
  ["Grapes", "Nectarines", "Okra", "Plums", "Summer Squash"],
  // September
  ["Apples", "Beets", "Cauliflower", "Pears", "Pumpkin"],
  // October
  ["Cranberries", "Fennel", "Persimmons", "Pomegranates", "Sweet Potatoes"],
  // November
  ["Chestnuts", "Collard Greens", "Parsnips", "Quinces", "Winter Squash"],
  // December
  ["Clementines", "Endive", "Grapefruit", "Kale", "Turnips"],
];
