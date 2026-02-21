import { Router } from "express";
import { prisma } from "@dotted/db";
import { authenticate, requireVerified } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { getUserPreferenceSummary, getPersonalizedDishRanking, recordPreferenceSignal } from "../services/personalization";
import { checkFeatureAccess } from "../services/subscription";
import { computeDishOptimizationScores } from "../services/optimization";

export const personalizationRouter = Router();

// GET /recommendations — personalized dish rankings for current cycle
personalizationRouter.get("/recommendations", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const cycleId = req.query.cycleId as string;
    const zoneId = req.query.zoneId as string;

    if (!cycleId || !zoneId) {
      throw new AppError("cycleId and zoneId query parameters required", 400);
    }

    // Get optimization scores for dishes
    let dishes = await computeDishOptimizationScores(cycleId, zoneId);

    // Premium users get personalized ranking
    const hasPremium = await checkFeatureAccess(userId, "personalized_ranking");
    if (hasPremium) {
      dishes = await getPersonalizedDishRanking(userId, dishes);
    }

    res.json({ success: true, data: { dishes, personalized: hasPremium } });
  } catch (err) {
    next(err);
  }
});

// GET /preferences — user preference summary
personalizationRouter.get("/preferences", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const summary = await getUserPreferenceSummary(userId);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// POST /signal — record preference signal
personalizationRouter.post("/signal", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { signalType, dishName, cuisine, tags } = req.body;

    if (!signalType) throw new AppError("signalType required", 400);

    const signal = await recordPreferenceSignal(userId, { signalType, dishName, cuisine, tags });
    res.status(201).json({ success: true, data: signal });
  } catch (err) {
    next(err);
  }
});
