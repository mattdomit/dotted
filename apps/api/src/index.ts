import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { initSocket } from "./socket/handlers";
import { authRouter } from "./routes/auth";
import { zoneRouter } from "./routes/zones";
import { cycleRouter } from "./routes/cycles";
import { voteRouter } from "./routes/votes";
import { bidRouter } from "./routes/bids";
import { supplierRouter } from "./routes/suppliers";
import { orderRouter } from "./routes/orders";
import { aiRouter } from "./routes/ai";
import { adminRouter } from "./routes/admin";
import { restaurantRouter } from "./routes/restaurants";
import { reviewRouter } from "./routes/reviews";
import { paymentRouter } from "./routes/payments";
import { notificationRouter } from "./routes/notifications";
import { uploadRouter } from "./routes/uploads";
import { errorHandler } from "./middleware/error-handler";
import { initCronJobs } from "./jobs/daily-cycle";
import { logger } from "./lib/logger";
import { startWorkers } from "./lib/queue";
import passport from "passport";
import { initPassport } from "./lib/passport";
import pinoHttp from "pino-http";

// Validate required environment variables on startup
const REQUIRED_ENV = ["DATABASE_URL"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  logger.fatal({ missing }, "Missing required environment variables");
  process.exit(1);
}

// Log optional service availability
const OPTIONAL_SERVICES = [
  { key: "STRIPE_SECRET_KEY", name: "Stripe Payments" },
  { key: "GOOGLE_CLIENT_ID", name: "Google OAuth" },
  { key: "RESEND_API_KEY", name: "Resend Email" },
  { key: "REDIS_URL", name: "Redis Cache" },
  { key: "TWILIO_ACCOUNT_SID", name: "Twilio SMS" },
  { key: "S3_ENDPOINT", name: "S3 Storage" },
];
for (const svc of OPTIONAL_SERVICES) {
  if (!process.env[svc.key]) {
    logger.warn(`${svc.name}: disabled (${svc.key} not set)`);
  }
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.API_PORT || 4000;

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.WEB_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: process.env.NODE_ENV === "production" }));
app.use(passport.initialize());
initPassport();

// Health check
app.get("/api/health", async (_req, res) => {
  const health: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  };

  // Check DB connectivity
  try {
    const { prisma } = await import("@dotted/db");
    await prisma.$queryRaw`SELECT 1`;
    health.database = "connected";
  } catch {
    health.database = "disconnected";
    health.status = "degraded";
  }

  res.status(health.status === "ok" ? 200 : 503).json(health);
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/zones", zoneRouter);
app.use("/api/cycles", cycleRouter);
app.use("/api/votes", voteRouter);
app.use("/api/bids", bidRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/orders", orderRouter);
app.use("/api/ai", aiRouter);
app.use("/api/admin", adminRouter);
app.use("/api/restaurants", restaurantRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/uploads", uploadRouter);

// Error handling
app.use(errorHandler);

// Socket.io
initSocket(httpServer);

// Background workers (if Redis available)
startWorkers();

// Cron jobs (fallback scheduler — queued jobs preferred when Redis is available)
initCronJobs();

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Dotted API running");
});

export default app;
