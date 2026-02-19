"use client";

import { useEffect, useState } from "react";

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
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/analytics`,
          { headers: { Authorization: `Bearer TODO_ADMIN_TOKEN` } }
        );
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data.data);
        }
      } catch {
        // silently fail for demo
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
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
        <p className="text-sm text-muted-foreground">
          Manual cycle override controls will be available here. Use the admin API endpoint to
          trigger cycle phases manually during development.
        </p>
        <pre className="mt-4 rounded-md bg-muted p-4 text-xs">
          POST /api/admin/cycles/override{"\n"}
          {"{"} &quot;cycleId&quot;: &quot;...&quot;, &quot;action&quot;: &quot;VOTING&quot; {"}"}
        </pre>
      </div>
    </div>
  );
}
