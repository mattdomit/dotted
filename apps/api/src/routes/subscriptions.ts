import { Router } from "express";
import { prisma } from "@dotted/db";
import { createSubscriptionSchema } from "@dotted/shared";
import { authenticate, requireVerified } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import { createSubscription, cancelSubscription, handleSubscriptionWebhook } from "../services/subscription";

export const subscriptionRouter = Router();

// POST / — create or upgrade subscription
subscriptionRouter.post("/", authenticate, requireVerified, validate(createSubscriptionSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { tier } = req.body;
    const subscription = await createSubscription(userId, tier);
    res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// DELETE / — cancel subscription
subscriptionRouter.delete("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const result = await cancelSubscription(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /me — current subscription status
subscriptionRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, loyaltyPoints: true, streak: true },
    });
    res.json({
      success: true,
      data: {
        subscription,
        tier: user?.subscriptionTier ?? "FREE",
        loyaltyPoints: user?.loyaltyPoints ?? 0,
        streak: user?.streak ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /webhook — Stripe webhook
subscriptionRouter.post("/webhook", async (req, res, next) => {
  try {
    await handleSubscriptionWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});
