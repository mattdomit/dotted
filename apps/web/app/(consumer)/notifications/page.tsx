"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: Notification[] }>("/notifications")
      .then((res) => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {}
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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Notifications</h1>
        <p className="mb-8 text-muted-foreground">Stay updated on orders, cycles, and bids.</p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-4 transition-colors ${
                  n.readAt ? "opacity-60" : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="shrink-0 rounded-md border px-3 py-1 text-xs hover:bg-muted"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
