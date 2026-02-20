import { Router, raw } from "express";
import { prisma } from "@dotted/db";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { getStripe } from "../lib/stripe";

export const paymentRouter = Router();

// POST /create-checkout-session — create Stripe Checkout Session for an order
paymentRouter.post("/create-checkout-session", authenticate, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) throw new AppError("orderId is required", 400);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { dish: { select: { name: true } } } },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== req.user!.userId) throw new AppError("Unauthorized", 403);
    if (order.status !== "PENDING") throw new AppError("Order is not pending", 400);

    const stripe = getStripe();
    if (!stripe) {
      // Dev mode: auto-confirm order without Stripe
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });
      res.json({ success: true, data: { devMode: true, order: updated } });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.dish.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: `${process.env.WEB_URL || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.WEB_URL || "http://localhost:3000"}/orders`,
      metadata: { orderId },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { stripeSessionId: session.id },
    });

    res.json({ success: true, data: { checkoutUrl: session.url } });
  } catch (err) {
    next(err);
  }
});

// POST /webhook — Stripe webhook (raw body, signature verification)
paymentRouter.post("/webhook", raw({ type: "application/json" }), async (req, res, next) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(200).json({ received: true, devMode: true });
      return;
    }

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new AppError("Webhook secret not configured", 500);

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch {
      throw new AppError("Invalid webhook signature", 400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { id: string; metadata?: { orderId?: string }; payment_status: string };
      if (session.payment_status === "paid" && session.metadata?.orderId) {
        // Idempotency: only update if not already confirmed
        const existing = await prisma.order.findUnique({
          where: { id: session.metadata.orderId },
          select: { stripePaymentId: true },
        });
        if (!existing?.stripePaymentId) {
          await prisma.order.update({
            where: { id: session.metadata.orderId },
            data: {
              status: "CONFIRMED",
              stripePaymentId: session.id,
              stripeSessionId: session.id,
            },
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// POST /refund — refund an order payment
paymentRouter.post("/refund", authenticate, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) throw new AppError("orderId is required", 400);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== req.user!.userId) throw new AppError("Unauthorized", 403);
    if (order.status === "REFUNDED") throw new AppError("Order already refunded", 400);

    const stripe = getStripe();
    if (!stripe) {
      // Dev mode: just mark as refunded
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "REFUNDED" },
      });
      res.json({ success: true, data: { devMode: true, order: updated } });
      return;
    }

    if (!order.stripeSessionId) throw new AppError("No payment session found for this order", 400);

    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (!session.payment_intent) throw new AppError("No payment intent found", 400);

    await stripe.refunds.create({
      payment_intent: session.payment_intent as string,
    });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    });

    res.json({ success: true, data: { order: updated } });
  } catch (err) {
    next(err);
  }
});

// GET /session/:sessionId — check payment session status
paymentRouter.get("/session/:sessionId", authenticate, async (req, res, next) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.json({ success: true, data: { status: "complete", devMode: true } });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId as string);
    res.json({
      success: true,
      data: {
        status: session.payment_status,
        orderId: session.metadata?.orderId,
      },
    });
  } catch (err) {
    next(err);
  }
});
