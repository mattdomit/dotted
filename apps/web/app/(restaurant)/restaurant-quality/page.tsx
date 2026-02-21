"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface QualityAgg {
  avgOverall: number;
  avgTaste: number;
  avgFreshness: number;
  avgPresentation: number;
  avgPortion: number;
  totalScores: number;
}

interface TrendPoint {
  date: string;
  avgOverall: number;
  count: number;
}

interface Alert {
  restaurantId: string;
  restaurantName: string;
  recentAvg: number;
  message: string;
}

export default function RestaurantQualityPage() {
  const { token, user } = useAuth();
  const [quality, setQuality] = useState<QualityAgg | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    // First find the restaurant owned by this user
    apiFetch<{ data: { id: string }[] }>("/restaurants/mine")
      .then((res) => {
        if (res.data.length > 0) {
          const rid = res.data[0].id;
          setRestaurantId(rid);
          return Promise.all([
            apiFetch<{ data: QualityAgg }>(`/quality/restaurant/${rid}`)
              .then((r) => setQuality(r.data))
              .catch(() => {}),
            apiFetch<{ data: TrendPoint[] }>(`/quality/trend/${rid}`)
              .then((r) => setTrend(r.data))
              .catch(() => {}),
            apiFetch<{ data: Alert[] }>("/quality/alerts")
              .then((r) => setAlerts(r.data))
              .catch(() => setAlerts([])),
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const dimensions = quality
    ? [
        { label: "Taste", value: quality.avgTaste },
        { label: "Freshness", value: quality.avgFreshness },
        { label: "Presentation", value: quality.avgPresentation },
        { label: "Portion", value: quality.avgPortion },
      ]
    : [];

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Quality Dashboard</h1>
        <p className="mb-6 text-muted-foreground">
          Track quality scores and trends for your restaurant.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading quality data...</p>
        ) : !quality || !restaurantId ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No quality data available yet. Scores appear once customers rate their orders.
          </div>
        ) : (
          <>
            {/* Alerts */}
            {alerts.filter((a) => a.restaurantId === restaurantId).length > 0 && (
              <div className="mb-6 space-y-2">
                {alerts
                  .filter((a) => a.restaurantId === restaurantId)
                  .map((alert, i) => (
                    <div key={i} className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      {alert.message}
                    </div>
                  ))}
              </div>
            )}

            {/* Overall Score */}
            <div className="mb-8 rounded-lg border p-6 text-center">
              <div className="text-5xl font-bold">{quality.avgOverall.toFixed(1)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Overall Quality Score ({quality.totalScores} ratings)
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {dimensions.map((dim) => (
                <div key={dim.label} className="rounded-lg border p-4 text-center">
                  <div className="text-2xl font-bold">{dim.value.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">{dim.label}</div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(dim.value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Trend */}
            {trend.length > 0 && (
              <div className="rounded-lg border p-6">
                <h2 className="mb-4 text-lg font-semibold">Quality Trend (Last 30 Days)</h2>
                <div className="flex items-end gap-1" style={{ height: 120 }}>
                  {trend.map((point, i) => {
                    const height = (point.avgOverall / 5) * 100;
                    return (
                      <div
                        key={i}
                        className="group relative flex-1"
                        title={`${point.date}: ${point.avgOverall.toFixed(1)} (${point.count} scores)`}
                      >
                        <div
                          className="mx-auto w-full max-w-[16px] rounded-t bg-primary transition-colors hover:bg-primary/80"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{trend[0]?.date}</span>
                  <span>{trend[trend.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
