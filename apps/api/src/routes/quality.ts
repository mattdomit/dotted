import { Router } from "express";
import { prisma } from "@dotted/db";
import { submitQualityScoreSchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole, requireVerified } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import {
  submitQualityScore,
  getRestaurantQuality,
  getQualityLeaderboard,
  getQualityTrend,
  checkQualityAlerts,
} from "../services/quality";
import { addLoyaltyPoints } from "../services/gamification";

export const qualityRouter = Router();

// POST /scores — submit quality score
qualityRouter.post("/scores", authenticate, requireVerified, validate(submitQualityScoreSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const score = await submitQualityScore({ ...req.body, userId });

    // Gamification: loyalty points for scoring
    addLoyaltyPoints(userId, 5, "quality_score").catch(() => {});

    res.status(201).json({ success: true, data: score });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) return next(new AppError(err.message, 404));
      if (err.message.includes("must be delivered")) return next(new AppError(err.message, 400));
      if (err.message.includes("already submitted")) return next(new AppError(err.message, 409));
      if (err.message.includes("own orders")) return next(new AppError(err.message, 403));
    }
    next(err);
  }
});

// GET /restaurant/:id — restaurant quality aggregation
qualityRouter.get("/restaurant/:id", async (req, res, next) => {
  try {
    const quality = await getRestaurantQuality(req.params.id);
    res.json({ success: true, data: quality });
  } catch (err) {
    next(err);
  }
});

// GET /leaderboard — zone quality leaderboard
qualityRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const zoneId = req.query.zoneId as string;
    if (!zoneId) throw new AppError("zoneId query parameter required", 400);
    const leaderboard = await getQualityLeaderboard(zoneId);
    res.json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
});

// GET /trend/:id — quality trend for restaurant
qualityRouter.get("/trend/:id", async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trend = await getQualityTrend(req.params.id, days);
    res.json({ success: true, data: trend });
  } catch (err) {
    next(err);
  }
});

// GET /alerts — admin quality alerts
qualityRouter.get("/alerts", authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, zoneId: true },
    });

    const alerts = [];
    for (const restaurant of restaurants) {
      const alert = await checkQualityAlerts(restaurant.id);
      if (alert.alert) {
        alerts.push({ ...alert, restaurantId: restaurant.id, restaurantName: restaurant.name });
      }
    }

    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
});
