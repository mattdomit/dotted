import { prisma } from "@dotted/db";
import { SUBSCRIPTION_TIERS } from "@dotted/shared";
import type { SubscriptionTier } from "@dotted/shared";
import { getStripe } from "../lib/stripe";
import { logger } from "../lib/logger";

export async function createSubscription(userId: string, tier: "PLUS" | "PREMIUM") {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing && !existing.cancelAtPeriodEnd) {
    throw new Error("Active subscription already exists. Cancel first or wait for period end.");
  }

  const stripe = getStripe();

  if (stripe) {
    // In production, create a Stripe checkout session
    logger.info({ userId, tier }, "Creating Stripe subscription checkout");
  }

  // Create/update subscription record
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
    update: {
      tier,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  });

  // Update user's subscription tier
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: tier },
  });

  return subscription;
}

export async function cancelSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) throw new Error("No subscription found");
  if (subscription.cancelAtPeriodEnd) throw new Error("Subscription already cancelled");

  await prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });

  return { message: "Subscription will be cancelled at end of period", periodEnd: subscription.currentPeriodEnd };
}

export async function handleSubscriptionWebhook(event: { type: string; data: Record<string, unknown> }) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const stripeSubId = event.data.id as string;
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
      });
      if (sub) {
        logger.info({ subscriptionId: sub.id, event: event.type }, "Subscription webhook processed");
      }
      break;
    }
    case "customer.subscription.deleted": {
      const stripeSubId = event.data.id as string;
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
      });
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: true },
        });
        await prisma.user.update({
          where: { id: sub.userId },
          data: { subscriptionTier: "FREE" },
        });
        logger.info({ subscriptionId: sub.id }, "Subscription cancelled via webhook");
      }
      break;
    }
  }
}

export function getSubscriptionLimits(tier: SubscriptionTier | string) {
  const key = tier as keyof typeof SUBSCRIPTION_TIERS;
  return SUBSCRIPTION_TIERS[key] ?? SUBSCRIPTION_TIERS.FREE;
}

export async function checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  if (!user) return false;

  const limits = getSubscriptionLimits(user.subscriptionTier);
  return (limits.features as readonly string[]).includes(feature);
}
