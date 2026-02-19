"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/lib/use-socket";

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
  const { user, token } = useAuth();
  const { joinCycle, leaveCycle, on } = useSocket();
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCycle() {
      try {
        const res = await apiFetch<{ data: CycleData }>(
          "/cycles/today?zoneId=demo"
        );
        setCycle(res.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCycle();
  }, []);

  // Live vote updates via socket.io
  useEffect(() => {
    if (!cycle?.id) return;
    joinCycle(cycle.id);

    const cleanup = on("vote:update", (data: { dishId: string; voteCount: number }) => {
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              dishes: prev.dishes.map((d) =>
                d.id === data.dishId ? { ...d, voteCount: data.voteCount } : d
              ),
            }
          : null
      );
    });

    return () => {
      leaveCycle(cycle.id);
      cleanup();
    };
  }, [cycle?.id, joinCycle, leaveCycle, on]);

  async function handleVote(dishId: string) {
    if (voted) return;
    if (!token) {
      setError("You must be signed in to vote.");
      return;
    }
    try {
      await apiFetch("/votes", {
        method: "POST",
        body: JSON.stringify({ dishId, dailyCycleId: cycle!.id }),
      });
      setVoted(dishId);
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
      <div className="min-h-screen">
        <Header />
        <div className="container flex min-h-[60vh] items-center justify-center">
          <div className="text-lg text-muted-foreground">Loading today&apos;s dishes...</div>
        </div>
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">No Active Cycle</h1>
          <p className="text-muted-foreground">
            {error || "Check back at 6 AM for today's dish suggestions!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
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
          {!user && (
            <p className="mt-2 text-sm text-amber-600">
              Sign in to cast your vote.
            </p>
          )}
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
                  disabled={!!voted || cycle.status !== "VOTING" || !token}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    isVoted
                      ? "bg-primary text-primary-foreground"
                      : voted
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  }`}
                >
                  {isVoted ? "Voted!" : voted ? "Already Voted" : "Vote for This"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
