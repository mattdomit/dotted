import { Router } from "express";
import { prisma } from "@dotted/db";
import { updateDeliverySchema, UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error-handler";
import { getIO } from "../socket/handlers";

export const deliveryRouter = Router();

// PATCH /purchase-orders/:id/delivery — create delivery tracking entry
deliveryRouter.patch(
  "/purchase-orders/:id/delivery",
  authenticate,
  requireRole(UserRole.SUPPLIER, UserRole.ADMIN),
  validate(updateDeliverySchema),
  async (req, res, next) => {
    try {
      const poId = req.params.id as string;
      const { status, latitude, longitude, note, estimatedArrival } = req.body;

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { supplier: { select: { ownerId: true, id: true } } },
      });
      if (!po) throw new AppError("Purchase order not found", 404);

      // Verify supplier owns this PO (unless admin)
      if (req.user!.role !== UserRole.ADMIN && po.supplier.ownerId !== req.user!.userId) {
        throw new AppError("Not your purchase order", 403);
      }

      const tracking = await prisma.deliveryTracking.create({
        data: {
          purchaseOrderId: poId,
          status,
          latitude,
          longitude,
          note,
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        },
      });

      // Update PO status based on delivery status
      const poStatusMap: Record<string, string> = {
        DISPATCHED: "SHIPPED",
        IN_TRANSIT: "SHIPPED",
        ARRIVED: "SHIPPED",
        DELIVERED: "DELIVERED",
      };
      const newPoStatus = poStatusMap[status];
      if (newPoStatus) {
        await prisma.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: newPoStatus as any,
            actualDeliveryTime: status === "DELIVERED" ? new Date() : undefined,
          },
        });
      }

      // Recalculate supplier metrics if delivered
      if (status === "DELIVERED") {
        await recalculateSupplierMetrics(po.supplier.id);
      }

      // Emit socket event
      getIO()?.to(`delivery:${poId}`).emit("delivery:update", {
        purchaseOrderId: poId,
        status,
        tracking,
      });

      res.status(201).json({ success: true, data: tracking });
    } catch (err) {
      next(err);
    }
  }
);

// GET /purchase-orders/:id/tracking — get tracking history
deliveryRouter.get(
  "/purchase-orders/:id/tracking",
  authenticate,
  async (req, res, next) => {
    try {
      const tracking = await prisma.deliveryTracking.findMany({
        where: { purchaseOrderId: req.params.id as string },
        orderBy: { createdAt: "asc" },
      });
      res.json({ success: true, data: tracking });
    } catch (err) {
      next(err);
    }
  }
);

// GET /suppliers/:id/metrics — get supplier performance metrics
deliveryRouter.get("/suppliers/:id/metrics", authenticate, async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id as string },
      select: { onTimeRate: true, qualityScore: true, fulfillmentRate: true },
    });
    if (!supplier) throw new AppError("Supplier not found", 404);

    const totalDeliveries = await prisma.purchaseOrder.count({
      where: { supplierId: req.params.id as string, status: "DELIVERED" },
    });

    res.json({
      success: true,
      data: { ...supplier, totalDeliveries },
    });
  } catch (err) {
    next(err);
  }
});

async function recalculateSupplierMetrics(supplierId: string) {
  const allOrders = await prisma.purchaseOrder.findMany({
    where: { supplierId },
    select: {
      status: true,
      deliveryEta: true,
      actualDeliveryTime: true,
    },
  });

  const total = allOrders.length;
  if (total === 0) return;

  const delivered = allOrders.filter((o) => o.status === "DELIVERED");
  const fulfillmentRate = delivered.length / total;

  // On-time rate: delivered before or at ETA
  const onTimeDeliveries = delivered.filter((o) => {
    if (!o.deliveryEta || !o.actualDeliveryTime) return true;
    return o.actualDeliveryTime <= o.deliveryEta;
  });
  const onTimeRate = delivered.length > 0 ? onTimeDeliveries.length / delivered.length : 0;

  // Quality score: average of fulfillment and on-time (simplified)
  const qualityScore = (fulfillmentRate + onTimeRate) / 2;

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
    },
  });
}
