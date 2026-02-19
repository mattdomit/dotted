"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface Analytics {
  totals: {
    users: number;
    restaurants: number;
    suppliers: number;
    cycles: number;
    orders: number;
  };
  today: any[];
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycleAction, setCycleAction] = useState({ cycleId: "", action: "" });
  const [actionResult, setActionResult] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: Analytics }>("/admin/analytics")
      .then((res) => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCycleOverride(e: React.FormEvent) {
    e.preventDefault();
    setActionResult("");
    try {
      await apiFetch("/admin/cycles/override", {
        method: "POST",
        body: JSON.stringify(cycleAction),
      });
      setActionResult("Cycle updated successfully.");
    } catch (err: any) {
      setActionResult(err.message || "Failed to update cycle.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container flex min-h-[60vh] items-center justify-center">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const stats = analytics?.totals || {
    users: 0,
    restaurants: 0,
    suppliers: 0,
    cycles: 0,
    orders: 0,
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-8">
        <h1 className="mb-2 text-3xl font-bold">Admin Dashboard</h1>
        <p className="mb-8 text-muted-foreground">Platform overview and cycle management.</p>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Users", value: stats.users },
            { label: "Restaurants", value: stats.restaurants },
            { label: "Suppliers", value: stats.suppliers },
            { label: "Cycles", value: stats.cycles },
            { label: "Orders", value: stats.orders },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">Cycle Controls</h2>
          <form onSubmit={handleCycleOverride} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cycleId" className="mb-1 block text-sm font-medium">
                  Cycle ID
                </label>
                <input
                  id="cycleId"
                  value={cycleAction.cycleId}
                  onChange={(e) => setCycleAction((p) => ({ ...p, cycleId: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Cycle UUID"
                  required
                />
              </div>
              <div>
                <label htmlFor="action" className="mb-1 block text-sm font-medium">
                  Target Phase
                </label>
                <select
                  id="action"
                  value={cycleAction.action}
                  onChange={(e) => setCycleAction((p) => ({ ...p, action: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select phase...</option>
                  <option value="VOTING">VOTING</option>
                  <option value="BIDDING">BIDDING</option>
                  <option value="SOURCING">SOURCING</option>
                  <option value="ORDERING">ORDERING</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Override Cycle Phase
            </button>
          </form>
          {actionResult && (
            <p className="mt-4 text-sm text-muted-foreground">{actionResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}
