"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/lib/use-socket";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  dish: { name: string; imageUrl?: string };
}

interface OrderData {
  id: string;
  quantity: number;
  totalPrice: number;
  status: string;
  fulfillmentType: string;
  createdAt: string;
  items: OrderItem[];
  restaurant: { name: string; address: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  READY: "bg-green-100 text-green-800",
  PICKED_UP: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-gray-100 text-gray-800",
};

export default function OrdersPage() {
  const { user, token } = useAuth();
  const { joinOrder, leaveOrder, on } = useSocket();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: OrderData[] }>("/orders/mine")
      .then((res) => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Live order status updates
  useEffect(() => {
    if (orders.length === 0) return;

    orders.forEach((o) => joinOrder(o.id));

    const cleanup = on("order:status", (data: { orderId: string; status: string }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o))
      );
    });

    return () => {
      orders.forEach((o) => leaveOrder(o.id));
      cleanup();
    };
  }, [orders.length, joinOrder, leaveOrder, on]);

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8">
          <div className="rounded-lg border p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
            <p className="mb-6 text-muted-foreground">
              Sign in to view your order history.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">My Orders</h1>
        <p className="mb-8 text-muted-foreground">
          Track your dish-of-the-day orders.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold">No Orders Yet</h2>
            <p className="mb-4 text-muted-foreground">
              When a cycle reaches the ordering phase, you can place your order for the day&apos;s dish.
            </p>
            <Link
              href="/vote"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Vote on Today&apos;s Dishes
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{order.restaurant.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[order.status] || "bg-gray-100"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.restaurant.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      ${order.totalPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.fulfillmentType}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.dish.name}
                      </span>
                      <span className="text-muted-foreground">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Ordered {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
