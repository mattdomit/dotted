"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface SupplierMetrics {
  onTimeRate: number;
  qualityScore: number;
  fulfillmentRate: number;
  totalDeliveries: number;
}

interface SupplierInfo {
  id: string;
  businessName: string;
}

export default function MetricsPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<SupplierMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    // First get supplier ID
    apiFetch<{ data: SupplierInfo }>("/suppliers/inventory")
      .then(async () => {
        // Use the suppliers endpoint to get metrics
        const inventoryRes = await apiFetch<{ data: any[] }>("/suppliers/inventory");
        if (inventoryRes.data.length > 0) {
          const supplierId = inventoryRes.data[0].supplierId;
          const metricsRes = await apiFetch<{ data: SupplierMetrics }>(
            `/delivery/suppliers/${supplierId}/metrics`
          );
          setMetrics(metricsRes.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function formatPercent(val: number) {
    return `${(val * 100).toFixed(1)}%`;
  }

  function getColor(val: number) {
    if (val >= 0.8) return "text-green-600";
    if (val >= 0.5) return "text-yellow-600";
    return "text-red-600";
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="text-3xl font-bold">Performance Metrics</h1>
        <p className="mt-1 text-muted-foreground">
          Your delivery performance and reliability scores.
        </p>

        {loading ? (
          <p className="mt-6 text-muted-foreground">Loading metrics...</p>
        ) : !metrics ? (
          <p className="mt-6 text-center text-muted-foreground">
            No metrics available yet. Complete deliveries to see your scores.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-6 text-center">
              <div className={`text-3xl font-bold ${getColor(metrics.onTimeRate)}`}>
                {formatPercent(metrics.onTimeRate)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">On-Time Rate</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Deliveries arriving by ETA
              </p>
            </div>

            <div className="rounded-lg border p-6 text-center">
              <div className={`text-3xl font-bold ${getColor(metrics.qualityScore)}`}>
                {formatPercent(metrics.qualityScore)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Quality Score</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Overall quality rating
              </p>
            </div>

            <div className="rounded-lg border p-6 text-center">
              <div className={`text-3xl font-bold ${getColor(metrics.fulfillmentRate)}`}>
                {formatPercent(metrics.fulfillmentRate)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Fulfillment Rate</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Orders successfully delivered
              </p>
            </div>

            <div className="rounded-lg border p-6 text-center">
              <div className="text-3xl font-bold">{metrics.totalDeliveries}</div>
              <div className="mt-1 text-sm text-muted-foreground">Total Deliveries</div>
              <p className="mt-2 text-xs text-muted-foreground">
                All-time completed deliveries
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
