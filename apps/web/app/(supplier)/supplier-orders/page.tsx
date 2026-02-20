"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface POItem {
  id: string;
  quantity: number;
  unitPrice: number;
  inventoryItem: { ingredientName: string; unit: string };
}

interface PurchaseOrder {
  id: string;
  totalCost: number;
  status: string;
  createdAt: string;
  items: POItem[];
  dailyCycle: { date: string };
}

export default function SupplierOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: PurchaseOrder[] }>("/suppliers/orders")
      .then((res) => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
          <Link href="/login" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Purchase Orders</h1>
        <p className="mb-8 text-muted-foreground">
          Ingredient orders placed by the system for winning restaurant bids.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold">No Purchase Orders</h2>
            <p className="text-muted-foreground">
              When a restaurant wins a bid, purchase orders will be created for your inventory items.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((po) => (
              <div key={po.id} className="rounded-lg border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">
                      PO for {new Date(po.dailyCycle.date).toLocaleDateString()}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {new Date(po.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${po.totalCost.toFixed(2)}</div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {po.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {po.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantity} {item.inventoryItem.unit} {item.inventoryItem.ingredientName}
                      </span>
                      <span className="text-muted-foreground">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
