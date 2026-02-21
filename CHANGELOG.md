# Changelog

All notable changes to the Dotted project will be documented in this file.

## [2.0.0] - 2026-02-21

### Added — Constraint-Based Optimization Engine
- Multi-objective dish optimization scoring: quality prediction, freshness scoring, variety scoring, waste risk assessment
- Composite ranking formula with configurable zone-level weights (quality, freshness, variety, cost, waste)
- Historical quality data integration for cuisine-based quality prediction
- Ingredient freshness window scoring from supplier inventory data
- Jaccard distance-based variety scoring against last 14 winning dishes
- Equipment-based dish filtering — AI only suggests dishes compatible with zone restaurant capabilities

### Added — Multi-Dimensional Quality System
- 4-dimension quality scoring: taste, freshness, presentation, portion size (1-5 scale each)
- `QualityScore` model with per-order scoring, restaurant aggregation, trend tracking
- Quality leaderboard by zone, rolling 5-score alert detection
- Restaurant quality dashboard with dimension breakdown and 30-day trend visualization
- Consumer quality scoring page with interactive rating UI

### Added — Subscription & Revenue Model
- 3-tier subscription system: FREE, PLUS ($9.99/mo), PREMIUM ($19.99/mo)
- Feature gating: votes per cycle, orders per day, personalized rankings (Premium)
- `Subscription` model with Stripe webhook integration
- Partner tiers for restaurants: STANDARD (10%), SILVER (8%), GOLD (6%), PLATINUM (4%) commission rates
- Restaurant-level commission rate overrides

### Added — Personalization Engine
- `UserPreferenceSignal` model tracking VOTE, ORDER, VIEW, SKIP signals
- Weighted cuisine and tag preference aggregation (ORDER=3x, VOTE=2x, VIEW=1x, SKIP=-1x)
- Personalized dish re-ranking for Premium subscribers
- Preference summary API endpoint

### Added — Advanced Analytics
- Zone-level analytics: orders, revenue, quality, waste, active cycles
- Revenue breakdown by zone with subscription revenue tracking
- 30-day moving average demand forecast with day-of-week seasonality
- Waste reporting per cycle with historical tracking
- Admin analytics dashboard with zone selector, revenue charts, forecast visualization, and optimization weight controls

### Added — Gamification System
- Achievement/badge system: 10 badges including first_vote, five_day_streak, quality_scorer, premium_member, variety_explorer
- Consecutive day streak tracking with automatic reset
- Loyalty points: +10/order, +2/vote, +5/quality-score, +1/streak-day
- Points leaderboard by zone
- Achievements page with badge grid, streak counter, and leaderboard

### Added — Enhanced Bidding & Supplier Matching
- Equipment capability check in bid scoring — restaurants must have required equipment
- Partner tier priority tiebreaker in bid scoring
- `maxConcurrentOrders` capacity cap — restaurants at capacity filtered from bidding
- Supplier `freshnessWindow`, `storageType`, `qualityGrade` scoring
- Bulk discount pricing with `bulkDiscountQty`/`bulkDiscountRate`
- `minimumOrderQty` enforcement, `temperatureControl` preference for perishables
- `maxDeliveryRadius` and `minOrderValue` supplier filtering

### Added — Frontend
- Subscription pricing page with 3-tier card layout, upgrade/cancel flow
- Consumer quality scoring page with order selection, 4-dimension sliders, leaderboard
- Achievements page with badge grid, streak counter, loyalty points, zone leaderboard
- Restaurant quality dashboard with dimension bars, trend chart, alert display
- Admin analytics dashboard with 5 tabs: overview, revenue, forecast, waste, optimization weights
- Optimization scores displayed on cycle page dishes (quality, freshness, waste badges)
- Enhanced supplier inventory form with freshness window, storage type, quality grade, bulk discount fields
- Quality scoring prompt link on order confirmation
- Header navigation: Quality, Subscription, Achievements links; Analytics for admin; Quality for restaurants

### Added — Schema
- 4 new Prisma models: `Subscription`, `QualityScore`, `Achievement`, `UserPreferenceSignal`
- `SubscriptionTier` enum (FREE, PLUS, PREMIUM)
- 30+ new fields across User, Zone, Restaurant, Supplier, SupplierInventory, Dish, DailyCycle models

### Added — Tests
- 9 new test files: optimization, quality, subscriptions, gamification, personalization, analytics, enhanced-bidding, enhanced-supplier, dish-generator-v2
- 387 total tests across 47 files (up from ~310)
- Updated test helpers with fixtures for all new models

### Changed
- Vote routes: duplicate check fires before tier limit check (409 before 429)
- Dish generator: post-generation optimization scoring and equipment filtering
- Supplier matcher: freshness, bulk discount, min order, temperature, delivery radius checks
- Bidding service: equipment, partner tier, concurrent order cap, dynamic commission rates
- Daily cycle jobs: dynamic timing from zone activity level, post-completion stats computation, achievement triggers
- Order routes: subscription tier limits, preference signals, loyalty points, streak updates
- Vote routes: subscription tier limits, preference signals, loyalty points

## [1.2.0] - 2026-02-19

### Added
- Comprehensive test suite — 233 tests across 25 files covering unit, integration, E2E, and infrastructure
- Vitest configuration with `fileParallelism: false` for shared Postgres
- Test helpers: database cleanup, auth factories, fixture builders, Anthropic SDK mocks
- Unit tests for middleware (auth, validation, error handling), Zod schemas, services (bidding, voting, procurement), AI layer (dish generator, supplier matcher), and cron jobs
- Integration tests for all 11 route groups (auth, zones, cycles, votes, bids, orders, suppliers, restaurants, reviews, admin, AI)
- WebSocket integration tests with real socket.io server
- Full daily cycle E2E test — 10 sequential steps from cycle creation through completion
- Infrastructure tests (DB connectivity, PostGIS, Prisma models, health endpoint, seed integrity)
- GitHub Actions CI workflow with PostGIS service container
- Test coverage reporting with artifact upload and job summary table

### Changed
- Exported `runDailyCycleForAllZones` from `jobs/daily-cycle.ts` for testability

## [1.1.0] - 2025-12-15

### Added
- Restaurant enrollment flow: Prisma schema extensions, Zod validation, API endpoints (`GET /mine`, `POST /enroll`), and multi-section enrollment form
- Social review system: `Review` model, API routes for posting and listing reviews with automatic rating aggregation
- Daily cycle workflow enhancements: admin cycle transition/create endpoints, lightweight status endpoint, cycle summary, and real-time cycle dashboard UI
- Navigation links for Daily Cycle and Reviews on homepage

### Changed
- Bids page updated with auth check and personalized restaurant header

## [0.1.0] - 2025-11-01

### Added
- Initial full-stack monorepo scaffold (pnpm workspaces + Turborepo)
- Express API with auth, voting, bidding, orders, supplier, and admin routes
- Claude AI dish generation engine with structured `tool_use` output
- AI-powered supplier matching and procurement optimization
- Daily cycle cron orchestration (suggest, vote, bid, source, order)
- Real-time updates via Socket.io (votes, bids, order status)
- Next.js 14 frontend with consumer voting, restaurant bids, supplier inventory views
- Full Prisma schema (16 models) with seed data
- Docker Compose for PostgreSQL + PostGIS + Redis
- Bcrypt password hashing for seed users and dev utility scripts
