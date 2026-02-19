import { Router } from "express";
import { prisma } from "@dotted/db";
import { UserRole, updateInventorySchema } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const supplierRouter = Router();

// POST /enroll — create a new supplier profile for the authenticated user
supplierRouter.post(
  "/enroll",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  async (req, res, next) => {
    try {
      const existing = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (existing) throw new AppError("You already have a supplier profile", 409);

      const { businessName, address, certifications, zoneId } = req.body;
      if (!businessName || !address || !zoneId) {
        throw new AppError("businessName, address, and zoneId are required", 400);
      }

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError("Zone not found", 404);

      const supplier = await prisma.supplier.create({
        data: {
          ownerId: req.user!.userId,
          businessName,
          address,
          certifications: certifications || [],
          zoneId,
        },
      });

      res.status(201).json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }
);

supplierRouter.get(
  "/inventory",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (!supplier) throw new AppError("Supplier profile not found", 404);

      const inventory = await prisma.supplierInventory.findMany({
        where: { supplierId: supplier.id },
        orderBy: { updatedAt: "desc" },
      });
      res.json({ success: true, data: inventory });
    } catch (err) {
      next(err);
    }
  }
);

supplierRouter.post(
  "/inventory",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  validate(updateInventorySchema),
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (!supplier) throw new AppError("Supplier profile not found", 404);

      const { items } = req.body;
      const created = await prisma.$transaction(
        items.map((item: any) =>
          prisma.supplierInventory.create({
            data: { supplierId: supplier.id, ...item },
          })
        )
      );

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

supplierRouter.get(
  "/orders",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (!supplier) throw new AppError("Supplier profile not found", 404);

      const orders = await prisma.purchaseOrder.findMany({
        where: { supplierId: supplier.id },
        include: { items: { include: { inventoryItem: true } }, dailyCycle: { select: { date: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  }
);
