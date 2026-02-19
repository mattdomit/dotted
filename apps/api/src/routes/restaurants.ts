import { Router } from "express";
import { prisma } from "@dotted/db";
import { enrollRestaurantSchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const restaurantRouter = Router();

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
  requireRole(UserRole.RESTAURANT_OWNER),
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
