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
import { paymentRouter } from "../../routes/payments";
import { notificationRouter } from "../../routes/notifications";
import { uploadRouter } from "../../routes/uploads";
import { feedRouter } from "../../routes/feed";
import { deliveryRouter } from "../../routes/delivery";
import { userRouter } from "../../routes/users";
import { subscriptionRouter } from "../../routes/subscriptions";
import { qualityRouter } from "../../routes/quality";
import { analyticsRouter } from "../../routes/analytics";
import { personalizationRouter } from "../../routes/personalization";
import { errorHandler } from "../../middleware/error-handler";
import passport from "passport";

/**
 * Builds an Express app identical to src/index.ts but without
 * starting the HTTP server, cron jobs, or socket.io.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(passport.initialize());

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
  app.use("/api/payments", paymentRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/uploads", uploadRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/users", userRouter);
  app.use("/api/subscriptions", subscriptionRouter);
  app.use("/api/quality", qualityRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/personalization", personalizationRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
