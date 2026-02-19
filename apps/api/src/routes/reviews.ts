import { Router } from "express";
import { prisma } from "@dotted/db";
import { createReviewSchema } from "@dotted/shared";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const reviewRouter = Router();

// GET /restaurant/:restaurantId — list reviews for a restaurant
reviewRouter.get("/restaurant/:restaurantId", async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { restaurantId: req.params.restaurantId },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    res.json({
      success: true,
      data: { reviews, averageRating: Math.round(avg * 10) / 10, total: reviews.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /mine — list reviews by the authenticated user
reviewRouter.get("/mine", authenticate, async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user!.userId },
      include: {
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
});

// POST / — create a review (authenticated)
reviewRouter.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  async (req, res, next) => {
    try {
      const { restaurantId, orderId, rating, title, body } = req.body;
      const userId = req.user!.userId;

      // Verify restaurant exists
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });
      if (!restaurant) throw new AppError("Restaurant not found", 404);

      // If orderId provided, verify it belongs to this user and restaurant
      if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError("Order not found", 404);
        if (order.userId !== userId) throw new AppError("Not your order", 403);
        if (order.restaurantId !== restaurantId) {
          throw new AppError("Order does not belong to this restaurant", 400);
        }

        // Check if review already exists for this order
        const existingReview = await prisma.review.findUnique({
          where: { userId_orderId: { userId, orderId } },
        });
        if (existingReview) {
          throw new AppError("You already reviewed this order", 409);
        }
      }

      const review = await prisma.review.create({
        data: { userId, restaurantId, orderId, rating, title, body },
        include: { user: { select: { name: true, avatarUrl: true } } },
      });

      // Update restaurant average rating
      const agg = await prisma.review.aggregate({
        where: { restaurantId },
        _avg: { rating: true },
      });
      if (agg._avg.rating !== null) {
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: { rating: Math.round(agg._avg.rating * 10) / 10 },
        });
      }

      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }
);
