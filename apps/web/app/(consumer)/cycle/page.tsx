"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { ZonePicker } from "@/components/zone-picker";
import { apiFetch } from "@/lib/api";

interface CycleStatus {
  id: string;
  status: string;
  date: string;
  winningDishId?: string;
  winningBidId?: string;
  _count: {
    dishes: number;
    votes: number;
    bids: number;
    orders: number;
  };
}

interface DishData {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  voteCount: number;
  estimatedCost: number;
}

interface CycleDetail {
  id: string;
  status: string;
  date: string;
  dishes: DishData[];
  zone?: { name: string; slug: string };
}

const PHASE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  SUGGESTING: {
    label: "AI Suggesting",
    color: "bg-purple-100 text-purple-800",
    description: "Our AI is generating dish suggestions from local supplier inventory.",
  },
  VOTING: {
    label: "Community Voting",
    color: "bg-blue-100 text-blue-800",
    description: "Vote for your favorite dish! Voting closes at 12 PM.",
  },
  BIDDING: {
    label: "Restaurant Bidding",
    color: "bg-amber-100 text-amber-800",
    description: "Restaurants are competing to cook the winning dish. Bidding closes at 2 PM.",
  },
  SOURCING: {
    label: "Ingredient Sourcing",
    color: "bg-orange-100 text-orange-800",
    description: "The winning restaurant is sourcing fresh ingredients from local suppliers.",
  },
  ORDERING: {
    label: "Orders Open",
    color: "bg-green-100 text-green-800",
    description: "Place your order now! The kitchen is preparing tonight's dish.",
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-gray-100 text-gray-800",
    description: "Today's cycle is complete. See you tomorrow!",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    description: "Today's cycle was cancelled.",
  },
};

const PHASES_ORDER = [
  "SUGGESTING",
  "VOTING",
  "BIDDING",
  "SOURCING",
  "ORDERING",
  "COMPLETED",
];

export default function CyclePage() {
  const [zoneId, setZoneId] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [cycleStatus, setCycleStatus] = useState<CycleStatus | null>(null);
  const [cycleDetail, setCycleDetail] = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchCycle(zid: string) {
    setLoading(true);
    setError("");
    try {
      const statusData = await apiFetch<{ data: CycleStatus }>(
        `/cycles/today/status?zoneId=${zid}`
      );
      setCycleStatus(statusData.data);

      try {
        const detailData = await apiFetch<{ data: CycleDetail }>(
          `/cycles/${statusData.data.id}`
        );
        setCycleDetail(detailData.data);
      } catch {}

      setZoneId(zid);
    } catch (err: any) {
      if (err.message.includes("404") || err.message.includes("No cycle")) {
        setError("No cycle found for today in this zone.");
      } else {
        setError("Could not load cycle data.");
      }
      setCycleStatus(null);
      setCycleDetail(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (zoneInput.trim()) {
      fetchCycle(zoneInput.trim());
    }
  }

  // Auto-refresh every 30 seconds if viewing a cycle
  useEffect(() => {
    if (!zoneId) return;
    const interval = setInterval(() => fetchCycle(zoneId), 30000);
    return () => clearInterval(interval);
  }, [zoneId]);

  const currentPhase = cycleStatus?.status || "";
  const phaseConfig = PHASE_CONFIG[currentPhase];
  const currentPhaseIndex = PHASES_ORDER.indexOf(currentPhase);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
      <h1 className="mb-2 text-3xl font-bold">Daily Cycle Dashboard</h1>
      <p className="mb-8 text-muted-foreground">
        Track today&apos;s dish-of-the-day cycle in real time.
      </p>

      {/* Zone Search */}
      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <div className="flex-1">
          <ZonePicker
            value={zoneInput}
            onChange={(id) => setZoneInput(id)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Track Cycle
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-center text-muted-foreground">Loading cycle data...</p>
      )}

      {!loading && cycleStatus && (
        <>
          {/* Phase Progress */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cycle Progress</h2>
              {cycleDetail?.zone && (
                <span className="text-sm text-muted-foreground">
                  Zone: {cycleDetail.zone.name}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4 flex gap-1">
              {PHASES_ORDER.map((phase, i) => (
                <div
                  key={phase}
                  className={`h-2 flex-1 rounded-full ${
                    i <= currentPhaseIndex
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Phase Labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
              {PHASES_ORDER.map((phase) => (
                <span
                  key={phase}
                  className={phase === currentPhase ? "font-bold text-primary" : ""}
                >
                  {PHASE_CONFIG[phase]?.label.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>

          {/* Current Phase Card */}
          {phaseConfig && (
            <div className={`mb-8 rounded-lg border p-6 ${phaseConfig.color}`}>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">{phaseConfig.label}</div>
              </div>
              <p className="mt-2 text-sm">{phaseConfig.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{cycleStatus._count.dishes}</div>
              <div className="text-xs text-muted-foreground">Dishes</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{cycleStatus._count.votes}</div>
              <div className="text-xs text-muted-foreground">Votes</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{cycleStatus._count.bids}</div>
              <div className="text-xs text-muted-foreground">Bids</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{cycleStatus._count.orders}</div>
              <div className="text-xs text-muted-foreground">Orders</div>
            </div>
          </div>

          {/* Dishes */}
          {cycleDetail?.dishes && cycleDetail.dishes.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">
                {currentPhase === "VOTING" ? "Vote for a Dish" : "Today's Dishes"}
              </h2>
              <div className="space-y-3">
                {cycleDetail.dishes.map((dish, i) => (
                  <div
                    key={dish.id}
                    className={`rounded-lg border p-4 ${
                      i === 0 && currentPhase !== "SUGGESTING"
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {i === 0 && currentPhase !== "SUGGESTING" && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                              Leading
                            </span>
                          )}
                          <h3 className="font-semibold">{dish.name}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dish.description}
                        </p>
                        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                          <span>{dish.cuisine}</span>
                          <span>~${dish.estimatedCost.toFixed(2)}/plate</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{dish.voteCount}</div>
                        <div className="text-xs text-muted-foreground">votes</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">Today&apos;s Schedule</h2>
            <div className="space-y-3">
              {[
                { time: "6:00 AM", label: "AI generates dishes", phase: "SUGGESTING" },
                { time: "6:00 AM – 12:00 PM", label: "Community voting", phase: "VOTING" },
                { time: "12:00 PM – 2:00 PM", label: "Restaurant bidding", phase: "BIDDING" },
                { time: "2:00 PM – 5:00 PM", label: "Ingredient sourcing", phase: "SOURCING" },
                { time: "5:00 PM – 9:30 PM", label: "Orders open", phase: "ORDERING" },
                { time: "9:30 PM", label: "Cycle complete", phase: "COMPLETED" },
              ].map((item) => {
                const isActive = item.phase === currentPhase;
                const isPast = PHASES_ORDER.indexOf(item.phase) < currentPhaseIndex;
                return (
                  <div
                    key={item.phase}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : isPast
                        ? "text-muted-foreground line-through"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="w-40 shrink-0 font-mono text-xs">{item.time}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        Now
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
