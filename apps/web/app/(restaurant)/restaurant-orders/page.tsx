"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  dish: { name: string };
}

interface RestaurantOrder {
  id: string;
  quantity: number;
  totalPrice: number;
  status: string;
  fulfillmentType: string;
  createdAt: string;
  items: OrderItem[];
  user: { name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  READY: "bg-green-100 text-green-800",
  PICKED_UP: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-gray-100 text-gray-800",
  REFUNDED: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, string> = {
  CONFIRMED: "READY",
  READY: "PICKED_UP",
  PICKED_UP: "DELIVERED",
};

const ACTION_LABELS: Record<string, string> = {
  READY: "Mark Ready",
  PICKED_UP: "Mark Picked Up",
  DELIVERED: "Mark Delivered",
};

export default function RestaurantOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: RestaurantOrder[] }>("/orders/restaurant")
      .then((res) => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

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

  const activeOrders = orders.filter((o) => !["DELIVERED", "REFUNDED"].includes(o.status));
  const completedOrders = orders.filter((o) => ["DELIVERED", "REFUNDED"].includes(o.status));

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Restaurant Orders</h1>
        <p className="mb-8 text-muted-foreground">
          Manage incoming orders for your restaurant.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold">No Orders Yet</h2>
            <p className="text-muted-foreground">
              Orders will appear here when consumers place orders during the ordering phase.
            </p>
          </div>
        ) : (
          <>
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-lg font-semibold">Active Orders ({activeOrders.length})</h2>
                <div className="space-y-4">
                  {activeOrders.map((order) => {
                    const nextStatus = NEXT_STATUS[order.status];
                    return (
                      <div key={order.id} className="rounded-lg border p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{order.user.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-100"}`}>
                                {order.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{order.user.email}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">${order.totalPrice.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">{order.fulfillmentType.replace("_", " ")}</div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.dish.name}</span>
                              <span className="text-muted-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {nextStatus && (
                          <div className="mt-4">
                            <button
                              onClick={() => updateStatus(order.id, nextStatus)}
                              disabled={updatingId === order.id}
                              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {updatingId === order.id ? "Updating..." : ACTION_LABELS[nextStatus]}
                            </button>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold">Completed ({completedOrders.length})</h2>
                <div className="space-y-3">
                  {completedOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border p-4 opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.user.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-100"}`}>
                            {order.status}
                          </span>
                        </div>
                        <span className="font-medium">${order.totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
