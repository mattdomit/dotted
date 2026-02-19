import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "../../routes/auth";
import { zoneRouter } from "../../routes/zones";
import { cycleRouter } from "../../routes/cycles";
import { voteRouter } from "../../routes/votes";
import { bidRouter } from "../../routes/bids";
import { supplierRouter } from "../../routes/suppliers";
import { orderRouter } from "../../routes/orders";
import { aiRouter } from "../../routes/ai";
import { adminRouter } from "../../routes/admin";
import { restaurantRouter } from "../../routes/restaurants";
import { reviewRouter } from "../../routes/reviews";
import { errorHandler } from "../../middleware/error-handler";

/**
 * Builds an Express app identical to src/index.ts but without
 * starting the HTTP server, cron jobs, or socket.io.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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

  // Error handling
  app.use(errorHandler);

  return app;
}
