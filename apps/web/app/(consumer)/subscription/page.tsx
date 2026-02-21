"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface SubscriptionData {
  id: string;
  tier: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

interface MeData {
  subscription: SubscriptionData | null;
  tier: string;
  loyaltyPoints: number;
  streak: number;
}

const TIERS = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["1 vote per cycle", "2 orders per day", "Community access"],
  },
  {
    id: "PLUS",
    name: "Plus",
    price: "$9.99",
    period: "/month",
    features: [
      "3 votes per cycle",
      "5 orders per day",
      "Priority ordering",
      "Order history export",
    ],
  },
  {
    id: "PREMIUM",
    name: "Premium",
    price: "$19.99",
    period: "/month",
    features: [
      "5 votes per cycle",
      "10 orders per day",
      "Personalized dish rankings",
      "Priority ordering",
      "Early access to voting",
      "Premium badge",
    ],
  },
];

export default function SubscriptionPage() {
  const { token } = useAuth();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: MeData }>("/subscriptions/me")
      .then((res) => setMe(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubscribe(tier: string) {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ tier }),
      });
      setSuccess(`Subscribed to ${tier} plan!`);
      const res = await apiFetch<{ data: MeData }>("/subscriptions/me");
      setMe(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to subscribe");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/subscriptions", { method: "DELETE" });
      setSuccess("Subscription cancelled. You'll keep access until the end of your billing period.");
      const res = await apiFetch<{ data: MeData }>("/subscriptions/me");
      setMe(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  }

  const currentTier = me?.tier || "FREE";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-4xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Subscription Plans</h1>
        <p className="mb-8 text-muted-foreground">
          Upgrade your Dotted experience with more votes, orders, and personalized features.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>
        )}

        {/* Current Plan Summary */}
        {me && (
          <div className="mb-8 rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current Plan</div>
                <div className="text-xl font-bold">{currentTier}</div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold">{me.loyaltyPoints}</div>
                  <div className="text-xs text-muted-foreground">Points</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{me.streak}</div>
                  <div className="text-xs text-muted-foreground">Day Streak</div>
                </div>
              </div>
            </div>
            {me.subscription?.cancelAtPeriodEnd && (
              <p className="mt-2 text-sm text-amber-600">
                Cancels at end of period ({me.subscription.currentPeriodEnd ? new Date(me.subscription.currentPeriodEnd).toLocaleDateString() : "soon"})
              </p>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {TIERS.map((tier) => {
              const isCurrent = tier.id === currentTier;
              const isUpgrade = TIERS.findIndex((t) => t.id === tier.id) > TIERS.findIndex((t) => t.id === currentTier);
              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border p-6 ${
                    isCurrent ? "border-primary bg-primary/5" : ""
                  } ${tier.id === "PREMIUM" ? "ring-2 ring-primary" : ""}`}
                >
                  {tier.id === "PREMIUM" && (
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-primary">Most Popular</div>
                  )}
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {isCurrent ? (
                      <div className="text-center">
                        <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                          Current Plan
                        </span>
                        {tier.id !== "FREE" && !me?.subscription?.cancelAtPeriodEnd && (
                          <button
                            onClick={handleCancel}
                            disabled={actionLoading}
                            className="mt-3 block w-full text-sm text-muted-foreground hover:text-destructive"
                          >
                            Cancel Subscription
                          </button>
                        )}
                      </div>
                    ) : tier.id === "FREE" ? null : (
                      <button
                        onClick={() => handleSubscribe(tier.id)}
                        disabled={actionLoading}
                        className={`w-full rounded-md px-4 py-2 text-sm font-medium ${
                          isUpgrade
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border hover:bg-muted"
                        } disabled:opacity-50`}
                      >
                        {isUpgrade ? "Upgrade" : "Switch"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
