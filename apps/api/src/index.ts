import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
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
import { errorHandler } from "./middleware/error-handler";
import { initCronJobs } from "./jobs/daily-cycle";
import passport from "passport";
import { initPassport } from "./lib/passport";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.API_PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(passport.initialize());
initPassport();

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

// Error handling
app.use(errorHandler);

// Socket.io
initSocket(httpServer);

// Cron jobs
initCronJobs();

httpServer.listen(PORT, () => {
  console.log(`Dotted API running on http://localhost:${PORT}`);
});

export default app;
