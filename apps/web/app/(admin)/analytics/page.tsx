"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { ZonePicker } from "@/components/zone-picker";
import { apiFetch } from "@/lib/api";

interface ZoneAnalytics {
  zoneId: string;
  totalOrders: number;
  totalRevenue: number;
  avgQuality: number;
  wastePercentage: number;
  activeCycles: number;
}

interface RevenueBreakdown {
  totalRevenue: number;
  subscriptionRevenue: number;
  byZone: { zoneId: string; zoneName: string; revenue: number; orders: number }[];
}

interface ForecastData {
  movingAvg: number;
  forecast: number[];
  seasonality: number[];
}

interface WasteData {
  cycles: {
    cycleId: string;
    date: string;
    totalOrders: number;
    wastePercentage: number;
  }[];
  avgWaste: number;
}

interface OptWeights {
  quality: number;
  freshness: number;
  variety: number;
  cost: number;
  waste: number;
}

type Tab = "overview" | "revenue" | "forecast" | "waste" | "weights";

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [zoneId, setZoneId] = useState("");
  const [zoneAnalytics, setZoneAnalytics] = useState<ZoneAnalytics | null>(null);
  const [revenue, setRevenue] = useState<RevenueBreakdown | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [waste, setWaste] = useState<WasteData | null>(null);
  const [weights, setWeights] = useState<OptWeights>({
    quality: 0.30,
    freshness: 0.25,
    variety: 0.20,
    cost: 0.15,
    waste: 0.10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function loadZoneAnalytics(zid: string) {
    if (!zid) return;
    setLoading(true);
    apiFetch<{ data: ZoneAnalytics }>(`/analytics/zone/${zid}`)
      .then((res) => setZoneAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!token) return;
    if (tab === "revenue" && !revenue) {
      apiFetch<{ data: RevenueBreakdown }>("/analytics/revenue")
        .then((res) => setRevenue(res.data))
        .catch(() => {});
    }
  }, [tab, token, revenue]);

  useEffect(() => {
    if (!token || !zoneId) return;
    if (tab === "forecast" && !forecast) {
      apiFetch<{ data: ForecastData }>(`/analytics/forecast/${zoneId}`)
        .then((res) => setForecast(res.data))
        .catch(() => {});
    }
    if (tab === "waste" && !waste) {
      apiFetch<{ data: WasteData }>(`/analytics/waste?zoneId=${zoneId}`)
        .then((res) => setWaste(res.data))
        .catch(() => {});
    }
  }, [tab, token, zoneId, forecast, waste]);

  function handleZoneSelect(zid: string) {
    setZoneId(zid);
    setForecast(null);
    setWaste(null);
    loadZoneAnalytics(zid);
  }

  async function handleSaveWeights(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      setError(`Weights must sum to 1.0 (currently ${sum.toFixed(2)})`);
      return;
    }
    try {
      await apiFetch(`/admin/zones/${zoneId}/weights`, {
        method: "PUT",
        body: JSON.stringify(weights),
      });
      setSuccess("Optimization weights updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update weights");
    }
  }

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-8">
        <h1 className="mb-2 text-3xl font-bold">Analytics Dashboard</h1>
        <p className="mb-6 text-muted-foreground">
          Platform performance, revenue, demand forecasting, and waste tracking.
        </p>

        {/* Zone Selector */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm font-medium">Zone:</label>
          <div className="w-64">
            <ZonePicker
              id="analyticsZone"
              value={zoneId}
              onChange={handleZoneSelect}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 overflow-x-auto rounded-lg border p-1">
          {(["overview", "revenue", "forecast", "waste", "weights"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>}

        {/* Overview Tab */}
        {tab === "overview" && (
          <>
            {!zoneId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Select a zone to view analytics.
              </div>
            ) : loading ? (
              <p className="text-muted-foreground">Loading analytics...</p>
            ) : zoneAnalytics ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Orders</div>
                  <div className="text-2xl font-bold">{zoneAnalytics.totalOrders}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Revenue</div>
                  <div className="text-2xl font-bold">${zoneAnalytics.totalRevenue.toFixed(2)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Avg Quality</div>
                  <div className="text-2xl font-bold">{zoneAnalytics.avgQuality.toFixed(1)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Waste %</div>
                  <div className="text-2xl font-bold">{zoneAnalytics.wastePercentage.toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Cycles</div>
                  <div className="text-2xl font-bold">{zoneAnalytics.activeCycles}</div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Revenue Tab */}
        {tab === "revenue" && (
          <>
            {revenue ? (
              <>
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-6">
                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                    <div className="text-3xl font-bold">${revenue.totalRevenue.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border p-6">
                    <div className="text-sm text-muted-foreground">Subscription Revenue</div>
                    <div className="text-3xl font-bold">${revenue.subscriptionRevenue.toFixed(2)}</div>
                  </div>
                </div>
                {revenue.byZone.length > 0 && (
                  <div className="rounded-lg border">
                    <h3 className="border-b p-4 font-semibold">Revenue by Zone</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium">Zone</th>
                            <th className="px-4 py-3 text-left font-medium">Revenue</th>
                            <th className="px-4 py-3 text-left font-medium">Orders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenue.byZone.map((z) => (
                            <tr key={z.zoneId} className="border-b last:border-0">
                              <td className="px-4 py-3 font-medium">{z.zoneName}</td>
                              <td className="px-4 py-3">${z.revenue.toFixed(2)}</td>
                              <td className="px-4 py-3">{z.orders}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Loading revenue data...</p>
            )}
          </>
        )}

        {/* Forecast Tab */}
        {tab === "forecast" && (
          <>
            {!zoneId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Select a zone to view demand forecast.
              </div>
            ) : forecast ? (
              <>
                <div className="mb-6 rounded-lg border p-6">
                  <div className="text-sm text-muted-foreground">30-Day Moving Average (daily orders)</div>
                  <div className="text-3xl font-bold">{forecast.movingAvg.toFixed(1)}</div>
                </div>
                <div className="mb-6 rounded-lg border p-6">
                  <h3 className="mb-3 font-semibold">7-Day Forecast</h3>
                  <div className="flex items-end gap-2" style={{ height: 100 }}>
                    {forecast.forecast.map((val, i) => {
                      const max = Math.max(...forecast.forecast, 1);
                      const h = (val / max) * 100;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-xs font-medium">{val.toFixed(0)}</span>
                          <div className="w-full rounded-t bg-primary" style={{ height: `${h}%` }} />
                          <span className="text-xs text-muted-foreground">{DAYS[(new Date().getDay() + i + 1) % 7]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border p-6">
                  <h3 className="mb-3 font-semibold">Day-of-Week Seasonality</h3>
                  <div className="flex items-end gap-2" style={{ height: 100 }}>
                    {forecast.seasonality.map((val, i) => {
                      const max = Math.max(...forecast.seasonality, 1);
                      const h = (val / max) * 100;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-xs font-medium">{val.toFixed(1)}</span>
                          <div className="w-full rounded-t bg-blue-500" style={{ height: `${h}%` }} />
                          <span className="text-xs text-muted-foreground">{DAYS[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Loading forecast...</p>
            )}
          </>
        )}

        {/* Waste Tab */}
        {tab === "waste" && (
          <>
            {!zoneId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Select a zone to view waste report.
              </div>
            ) : waste ? (
              <>
                <div className="mb-6 rounded-lg border p-6 text-center">
                  <div className="text-sm text-muted-foreground">Average Waste</div>
                  <div className={`text-4xl font-bold ${waste.avgWaste > 20 ? "text-red-600" : waste.avgWaste > 10 ? "text-amber-600" : "text-green-600"}`}>
                    {waste.avgWaste.toFixed(1)}%
                  </div>
                </div>
                {waste.cycles.length > 0 && (
                  <div className="rounded-lg border">
                    <h3 className="border-b p-4 font-semibold">Cycle Waste History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium">Date</th>
                            <th className="px-4 py-3 text-left font-medium">Orders</th>
                            <th className="px-4 py-3 text-left font-medium">Waste %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {waste.cycles.map((c) => (
                            <tr key={c.cycleId} className="border-b last:border-0">
                              <td className="px-4 py-3">{new Date(c.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3">{c.totalOrders}</td>
                              <td className="px-4 py-3">
                                <span className={`font-medium ${c.wastePercentage > 20 ? "text-red-600" : c.wastePercentage > 10 ? "text-amber-600" : "text-green-600"}`}>
                                  {c.wastePercentage.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Loading waste data...</p>
            )}
          </>
        )}

        {/* Weights Tab */}
        {tab === "weights" && (
          <>
            {!zoneId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Select a zone to configure optimization weights.
              </div>
            ) : (
              <form onSubmit={handleSaveWeights} className="rounded-lg border p-6">
                <h3 className="mb-4 text-lg font-semibold">Optimization Weights</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Adjust how the AI prioritizes dish selection. All weights must sum to 1.0.
                </p>
                <div className="space-y-4">
                  {(Object.keys(weights) as (keyof OptWeights)[]).map((key) => (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium capitalize">{key}</label>
                        <span className="text-sm font-mono">{weights[key].toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={weights[key]}
                        onChange={(e) => setWeights((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Sum: {Object.values(weights).reduce((a, b) => a + b, 0).toFixed(2)}
                  </span>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Save Weights
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
