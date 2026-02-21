"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface OrderForScoring {
  id: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  restaurant: { id: string; name: string };
  dailyCycle: { date: string };
  items: { dish: { name: string } }[];
}

interface LeaderboardEntry {
  restaurantId: string;
  restaurantName: string;
  avgOverall: number;
  totalScores: number;
}

interface QualityDimension {
  key: string;
  label: string;
  value: number;
}

export default function QualityPage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState<OrderForScoring[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderForScoring | null>(null);
  const [dimensions, setDimensions] = useState<QualityDimension[]>([
    { key: "taste", label: "Taste", value: 3 },
    { key: "freshness", label: "Freshness", value: 3 },
    { key: "presentation", label: "Presentation", value: 3 },
    { key: "portion", label: "Portion Size", value: 3 },
  ]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"score" | "leaderboard">("score");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<{ data: { orders: OrderForScoring[] } }>("/orders?status=DELIVERED")
        .then((res) => setOrders(res.data.orders || []))
        .catch(() => {}),
      apiFetch<{ data: LeaderboardEntry[] }>("/quality/leaderboard")
        .then((res) => setLeaderboard(res.data))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [token]);

  function updateDimension(key: string, value: number) {
    setDimensions((prev) => prev.map((d) => (d.key === key ? { ...d, value } : d)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, any> = { orderId: selectedOrder.id };
      dimensions.forEach((d) => {
        body[d.key] = d.value;
      });
      if (comment.trim()) body.comment = comment.trim();
      await apiFetch("/quality/scores", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess("Quality score submitted! +5 loyalty points earned.");
      setSelectedOrder(null);
      setComment("");
      setDimensions((prev) => prev.map((d) => ({ ...d, value: 3 })));
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
    } catch (err: any) {
      setError(err.message || "Failed to submit score");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Quality Scores</h1>
        <p className="mb-6 text-muted-foreground">
          Rate your meals and help maintain food quality across the platform.
        </p>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border p-1">
          {(["score", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "score" ? "Rate Orders" : "Leaderboard"}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>}

        {tab === "score" && (
          <>
            {loading ? (
              <p className="text-muted-foreground">Loading delivered orders...</p>
            ) : !selectedOrder ? (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Select an order to rate</h2>
                {orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No delivered orders awaiting quality scores.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="w-full rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {order.items.map((i) => i.dish.name).join(", ")}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {order.restaurant.name} &middot; {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">${order.totalPrice.toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {selectedOrder.items.map((i) => i.dish.name).join(", ")}
                      </div>
                      <div className="text-sm text-muted-foreground">{selectedOrder.restaurant.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Dimension Sliders */}
                <div className="mb-6 space-y-5">
                  {dimensions.map((dim) => (
                    <div key={dim.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium">{dim.label}</label>
                        <span className="text-lg font-bold">{dim.value}/5</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateDimension(dim.key, v)}
                            className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                              v <= dim.value
                                ? "border-primary bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment */}
                <div className="mb-6">
                  <label className="mb-1 block text-sm font-medium">Comment (optional)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Any additional feedback..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Quality Score"}
                </button>
              </form>
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Restaurant Quality Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No quality scores recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.restaurantId}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      i === 0 ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? "bg-yellow-100 text-yellow-800" : i === 1 ? "bg-gray-100 text-gray-700" : i === 2 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-medium">{entry.restaurantName}</div>
                        <div className="text-xs text-muted-foreground">{entry.totalScores} ratings</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold">{entry.avgOverall.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
