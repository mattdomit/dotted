import { prisma } from "@dotted/db";

export async function getProcurementSummary(cycleId: string) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { dailyCycleId: cycleId },
    include: {
      supplier: { select: { businessName: true } },
      items: {
        include: { inventoryItem: { select: { ingredientName: true, unit: true } } },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    supplier: order.supplier.businessName,
    status: order.status,
    totalCost: order.totalCost,
    items: order.items.map((item) => ({
      ingredient: item.inventoryItem.ingredientName,
      quantity: item.quantity,
      unit: item.inventoryItem.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    })),
  }));
}

export async function updatePurchaseOrderStatus(
  orderId: string,
  status: "CONFIRMED" | "SHIPPED" | "DELIVERED"
) {
  return prisma.purchaseOrder.update({
    where: { id: orderId },
    data: { status },
  });
}
