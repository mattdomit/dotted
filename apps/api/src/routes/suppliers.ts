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

      // Auto-upgrade user role to SUPPLIER if they aren't already
      if (req.user!.role !== UserRole.SUPPLIER) {
        await prisma.user.update({
          where: { id: req.user!.userId },
          data: { role: UserRole.SUPPLIER },
        });
      }

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

// PATCH /inventory/:id — update an inventory item
supplierRouter.patch(
  "/inventory/:id",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (!supplier) throw new AppError("Supplier profile not found", 404);

      const item = await prisma.supplierInventory.findUnique({ where: { id: req.params.id as string } });
      if (!item) throw new AppError("Inventory item not found", 404);
      if (item.supplierId !== supplier.id) throw new AppError("Unauthorized", 403);

      const { pricePerUnit, quantityAvailable, isOrganic } = req.body;
      const updated = await prisma.supplierInventory.update({
        where: { id: item.id },
        data: {
          ...(pricePerUnit !== undefined && { pricePerUnit }),
          ...(quantityAvailable !== undefined && { quantityAvailable }),
          ...(isOrganic !== undefined && { isOrganic }),
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /inventory/:id — remove an inventory item
supplierRouter.delete(
  "/inventory/:id",
  authenticate,
  requireRole(UserRole.SUPPLIER),
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { ownerId: req.user!.userId } });
      if (!supplier) throw new AppError("Supplier profile not found", 404);

      const item = await prisma.supplierInventory.findUnique({ where: { id: req.params.id as string } });
      if (!item) throw new AppError("Inventory item not found", 404);
      if (item.supplierId !== supplier.id) throw new AppError("Unauthorized", 403);

      await prisma.supplierInventory.delete({ where: { id: item.id } });
      res.json({ success: true, data: { deleted: true } });
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
