# Changelog

All notable changes to the Dotted project will be documented in this file.

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
