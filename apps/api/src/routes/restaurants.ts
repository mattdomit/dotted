import { Router } from "express";
import { prisma } from "@dotted/db";
import { enrollRestaurantSchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const restaurantRouter = Router();

// GET / — list all restaurants (public, for reviews/search)
restaurantRouter.get("/", async (_req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, address: true, rating: true, zoneId: true, imageUrl: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: restaurants });
  } catch (err) {
    next(err);
  }
});

// GET /mine — return the authenticated user's restaurant
restaurantRouter.get("/mine", authenticate, async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
    });
    if (!restaurant) {
      throw new AppError("No restaurant found for this user", 404);
    }
    res.json({ success: true, data: restaurant });
  } catch (err) {
    next(err);
  }
});

// POST /enroll — create a new restaurant for the authenticated user
restaurantRouter.post(
  "/enroll",
  authenticate,
  validate(enrollRestaurantSchema),
  async (req, res, next) => {
    try {
      // Check if user already owns a restaurant
      const existing = await prisma.restaurant.findUnique({
        where: { ownerId: req.user!.userId },
      });
      if (existing) {
        throw new AppError("You already have an enrolled restaurant", 409);
      }

      const {
        businessName,
        businessLicenseNumber,
        taxId,
        ownerFullName,
        phone,
        email,
        address,
        city,
        state,
        zipCode,
        cuisineTypes,
        seatingCapacity,
        kitchenCapacity,
        healthPermitNumber,
        insurancePolicyNumber,
        yearsInOperation,
        website,
        description,
        zoneId,
      } = req.body;

      // Auto-upgrade user role to RESTAURANT_OWNER if they aren't already
      if (req.user!.role !== UserRole.RESTAURANT_OWNER) {
        await prisma.user.update({
          where: { id: req.user!.userId },
          data: { role: UserRole.RESTAURANT_OWNER },
        });
      }

      const restaurant = await prisma.restaurant.create({
        data: {
          ownerId: req.user!.userId,
          name: businessName,
          address,
          capacity: seatingCapacity,
          description: description || null,
          zoneId,
          businessLicenseNumber,
          taxId,
          ownerFullName: ownerFullName || null,
          phone,
          email,
          city,
          state,
          zipCode,
          cuisineTypes,
          kitchenCapacity,
          healthPermitNumber,
          insurancePolicyNumber,
          yearsInOperation,
          website: website || null,
        },
      });

      res.status(201).json({ success: true, data: restaurant });
    } catch (err) {
      next(err);
    }
  }
);
