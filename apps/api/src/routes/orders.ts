import { Router } from "express";
import { prisma } from "@dotted/db";
import { createOrderSchema, updateOrderStatusSchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import { getIO } from "../socket/handlers";
import { getStripe } from "../lib/stripe";
import { notify } from "../services/notifications";

export const orderRouter = Router();

orderRouter.post("/", authenticate, validate(createOrderSchema), async (req, res, next) => {
  try {
    const { dailyCycleId, restaurantId, quantity, fulfillmentType } = req.body;
    const userId = req.user!.userId;

    // Verify cycle is in ORDERING status
    const cycle = await prisma.dailyCycle.findUnique({
      where: { id: dailyCycleId },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
    if (cycle.status !== "ORDERING") throw new AppError("Orders are not open", 400);

    // Get winning bid for price
    const winningBid = await prisma.bid.findFirst({
      where: { dailyCycleId, status: "WON" },
    });
    if (!winningBid) throw new AppError("No winning bid found", 404);

    const totalPrice = winningBid.pricePerPlate * quantity;

    const order = await prisma.order.create({
      data: {
        userId,
        dailyCycleId,
        restaurantId,
        quantity,
        totalPrice,
        fulfillmentType,
        items: {
          create: {
            dishId: cycle.winningDishId!,
            quantity,
            price: winningBid.pricePerPlate,
          },
        },
      },
      include: { items: true },
    });

    // Notify user of order creation
    notify({
      userId,
      type: "ORDER_CREATED",
      title: "Order Placed",
      body: `Your order of ${quantity} plate(s) has been placed.`,
      channels: ["IN_APP"],
    }).catch(() => {}); // Fire-and-forget

    // If Stripe is not configured, auto-confirm in dev mode
    const stripe = getStripe();
    if (!stripe) {
      const confirmed = await prisma.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
        include: { items: true },
      });
      res.status(201).json({ success: true, data: confirmed });
      return;
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

orderRouter.get("/mine", authenticate, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: {
        items: { include: { dish: { select: { name: true, imageUrl: true } } } },
        restaurant: { select: { name: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /restaurant — get all orders for the restaurant owner's restaurant
orderRouter.get(
  "/restaurant",
  authenticate,
  requireRole(UserRole.RESTAURANT_OWNER),
  async (req, res, next) => {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { ownerId: req.user!.userId },
      });
      if (!restaurant) throw new AppError("No restaurant found for this user", 404);

      const orders = await prisma.order.findMany({
        where: { restaurantId: restaurant.id },
        include: {
          items: { include: { dish: { select: { name: true } } } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  }
);

orderRouter.patch(
  "/:id/status",
  authenticate,
  requireRole(UserRole.RESTAURANT_OWNER),
  validate(updateOrderStatusSchema),
  async (req, res, next) => {
    try {
      const orderId = req.params.id as string;

      // Verify order exists and belongs to this restaurant owner's restaurant
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { restaurant: { select: { ownerId: true } } },
      });
      if (!order) throw new AppError("Order not found", 404);
      if (order.restaurant.ownerId !== req.user!.userId) {
        throw new AppError("You can only update orders for your own restaurant", 403);
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: req.body.status },
      });

      // Emit real-time status update
      getIO()?.to(`order:${updated.id}`).emit("order:status", {
        orderId: updated.id,
        status: updated.status,
      });

      // Notify user of status change
      notify({
        userId: updated.userId,
        type: "ORDER_STATUS",
        title: `Order ${updated.status}`,
        body: `Your order status has been updated to ${updated.status}.`,
        channels: ["IN_APP"],
      }).catch(() => {});

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);
