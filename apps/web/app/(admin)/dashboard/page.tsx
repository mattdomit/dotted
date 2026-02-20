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

interface RevenueData {
  totalRevenue: number;
  todayRevenue: number;
  recentOrders: {
    id: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    restaurant: { name: string };
    user: { name: string };
  }[];
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface ZoneData {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  isActive: boolean;
  _count: { memberships: number; restaurants: number; suppliers: number; dailyCycles: number };
}

type Tab = "overview" | "users" | "zones" | "revenue";

export default function AdminDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleAction, setCycleAction] = useState({ cycleId: "", action: "" });
  const [actionResult, setActionResult] = useState("");
  const [newZone, setNewZone] = useState({ name: "", slug: "", city: "", state: "" });

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    apiFetch<{ data: Analytics }>("/admin/analytics")
      .then((res) => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (tab === "revenue" && !revenue) {
      apiFetch<{ data: RevenueData }>("/admin/revenue")
        .then((res) => setRevenue(res.data))
        .catch(() => {});
    }
    if (tab === "users" && users.length === 0) {
      apiFetch<{ data: { users: UserData[] } }>("/admin/users")
        .then((res) => setUsers(res.data.users))
        .catch(() => {});
    }
    if (tab === "zones" && zones.length === 0) {
      apiFetch<{ data: ZoneData[] }>("/admin/zones")
        .then((res) => setZones(res.data))
        .catch(() => {});
    }
  }, [tab, token, revenue, users.length, zones.length]);

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

  async function handleCreateZone(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch<{ data: ZoneData }>("/admin/zones", {
        method: "POST",
        body: JSON.stringify(newZone),
      });
      setZones((prev) => [...prev, { ...res.data, _count: { memberships: 0, restaurants: 0, suppliers: 0, dailyCycles: 0 } }]);
      setNewZone({ name: "", slug: "", city: "", state: "" });
    } catch (err: any) {
      alert(err.message);
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

  const stats = analytics?.totals || { users: 0, restaurants: 0, suppliers: 0, cycles: 0, orders: 0 };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-8">
        <h1 className="mb-2 text-3xl font-bold">Admin Dashboard</h1>
        <p className="mb-6 text-muted-foreground">Platform overview and management.</p>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-lg border p-1">
          {(["overview", "users", "zones", "revenue"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <>
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
                    <label htmlFor="cycleId" className="mb-1 block text-sm font-medium">Cycle ID</label>
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
                    <label htmlFor="action" className="mb-1 block text-sm font-medium">Target Phase</label>
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
                <button type="submit" className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Override Cycle Phase
                </button>
              </form>
              {actionResult && <p className="mt-4 text-sm text-muted-foreground">{actionResult}</p>}
            </div>
          </>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Zones Tab */}
        {tab === "zones" && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {zones.map((zone) => (
                <div key={zone.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{zone.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${zone.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {zone.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{zone.city}, {zone.state}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{zone._count.memberships} members</span>
                    <span>{zone._count.restaurants} restaurants</span>
                    <span>{zone._count.suppliers} suppliers</span>
                    <span>{zone._count.dailyCycles} cycles</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-6">
              <h3 className="mb-4 text-lg font-semibold">Create Zone</h3>
              <form onSubmit={handleCreateZone} className="grid gap-4 sm:grid-cols-2">
                <input value={newZone.name} onChange={(e) => setNewZone((p) => ({ ...p, name: e.target.value }))} placeholder="Zone Name" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                <input value={newZone.slug} onChange={(e) => setNewZone((p) => ({ ...p, slug: e.target.value }))} placeholder="slug" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                <input value={newZone.city} onChange={(e) => setNewZone((p) => ({ ...p, city: e.target.value }))} placeholder="City" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                <input value={newZone.state} onChange={(e) => setNewZone((p) => ({ ...p, state: e.target.value }))} placeholder="State" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                <button type="submit" className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:col-span-2">
                  Create Zone
                </button>
              </form>
            </div>
          </>
        )}

        {/* Revenue Tab */}
        {tab === "revenue" && revenue && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-6">
                <div className="text-sm text-muted-foreground">Total Revenue</div>
                <div className="text-3xl font-bold">${revenue.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border p-6">
                <div className="text-sm text-muted-foreground">Today&apos;s Revenue</div>
                <div className="text-3xl font-bold">${revenue.todayRevenue.toFixed(2)}</div>
              </div>
            </div>

            <div className="rounded-lg border">
              <h3 className="border-b p-4 font-semibold">Recent Orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Customer</th>
                      <th className="px-4 py-3 text-left font-medium">Restaurant</th>
                      <th className="px-4 py-3 text-left font-medium">Amount</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.recentOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{order.user.name}</td>
                        <td className="px-4 py-3">{order.restaurant.name}</td>
                        <td className="px-4 py-3 font-medium">${order.totalPrice.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{order.status}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
