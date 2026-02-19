import { Router } from "express";
import { prisma } from "@dotted/db";
import { UserRole, updateInventorySchema } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";

export const supplierRouter = Router();

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
