"use client";

import { useEffect, useState } from "react";

interface Dish {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  estimatedCost: number;
  voteCount: number;
  ingredients: { name: string; quantity: number; unit: string }[];
}

interface CycleData {
  id: string;
  status: string;
  dishes: Dish[];
}

export default function VotePage() {
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCycle() {
      try {
        // TODO: Get zoneId from user context
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/cycles/today?zoneId=demo`
        );
        if (!res.ok) throw new Error("No active cycle today");
        const data = await res.json();
        setCycle(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCycle();
  }, []);

  async function handleVote(dishId: string) {
    if (voted) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/votes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dishId, dailyCycleId: cycle!.id }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Vote failed");
      }
      setVoted(dishId);
      // Optimistic update
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              dishes: prev.dishes.map((d) =>
                d.id === dishId ? { ...d, voteCount: d.voteCount + 1 } : d
              ),
            }
          : null
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  const totalVotes = cycle?.dishes.reduce((sum, d) => sum + d.voteCount, 0) || 0;

  if (loading) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading today&apos;s dishes...</div>
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="container flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">No Active Cycle</h1>
        <p className="text-muted-foreground">
          {error || "Check back at 6 AM for today's dish suggestions!"}
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Today&apos;s Dish Vote</h1>
        <p className="mt-2 text-muted-foreground">
          {cycle.status === "VOTING"
            ? "Pick your favorite! Voting closes at noon."
            : `Voting is ${cycle.status.toLowerCase()}`}
        </p>
        <div className="mt-4 text-sm text-muted-foreground">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cycle.dishes.map((dish) => {
          const percentage = totalVotes > 0 ? Math.round((dish.voteCount / totalVotes) * 100) : 0;
          const isVoted = voted === dish.id;

          return (
            <div
              key={dish.id}
              className={`rounded-lg border p-6 transition-all ${
                isVoted ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {dish.cuisine}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  ~${dish.estimatedCost.toFixed(2)}/plate
                </span>
              </div>

              <h3 className="mb-2 text-xl font-semibold">{dish.name}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{dish.description}</p>

              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{dish.voteCount} votes</span>
                  <span>{percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <details className="mb-4">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Ingredients ({dish.ingredients.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {dish.ingredients.map((ing, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      {ing.quantity} {ing.unit} {ing.name}
                    </li>
                  ))}
                </ul>
              </details>

              <button
                onClick={() => handleVote(dish.id)}
                disabled={!!voted || cycle.status !== "VOTING"}
                className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isVoted
                    ? "bg-primary text-primary-foreground"
                    : voted
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isVoted ? "Voted!" : voted ? "Already Voted" : "Vote for This"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
