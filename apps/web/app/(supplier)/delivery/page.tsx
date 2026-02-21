"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface PurchaseOrder {
  id: string;
  status: string;
  totalCost: number;
  deliveryEta?: string;
  createdAt: string;
  items: { inventoryItem: { ingredientName: string; unit: string }; quantity: number; unitPrice: number }[];
}

const DELIVERY_STATUSES = ["DISPATCHED", "IN_TRANSIT", "ARRIVED", "DELIVERED"] as const;

export default function DeliveryPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: PurchaseOrder[] }>("/suppliers/orders")
      .then((res) => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function updateDelivery(poId: string, status: string) {
    setError("");
    try {
      await apiFetch(`/delivery/purchase-orders/${poId}/delivery`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      // Refresh orders
      const res = await apiFetch<{ data: PurchaseOrder[] }>("/suppliers/orders");
      setOrders(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to update delivery");
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="text-3xl font-bold">Delivery Management</h1>
        <p className="mt-1 text-muted-foreground">Track and update your purchase order deliveries.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {loading ? (
          <p className="mt-6 text-muted-foreground">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="mt-6 text-center text-muted-foreground">No purchase orders yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((po) => (
              <div key={po.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">PO #{po.id.slice(0, 8)}</span>
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {po.status}
                    </span>
                  </div>
                  <span className="text-sm font-medium">${po.totalCost.toFixed(2)}</span>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Created: {new Date(po.createdAt).toLocaleDateString()}
                  {po.deliveryEta && ` · ETA: ${new Date(po.deliveryEta).toLocaleDateString()}`}
                </div>

                <div className="mt-2 space-y-1">
                  {po.items?.map((item, i) => (
                    <div key={i} className="text-sm">
                      {item.inventoryItem?.ingredientName}: {item.quantity} {item.inventoryItem?.unit} @ ${item.unitPrice}
                    </div>
                  ))}
                </div>

                {po.status !== "DELIVERED" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DELIVERY_STATUSES.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateDelivery(po.id, status)}
                        className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
