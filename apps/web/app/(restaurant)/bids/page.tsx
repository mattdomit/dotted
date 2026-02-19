"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface RestaurantData {
  id: string;
  name: string;
  address: string;
  capacity: number;
  isVerified: boolean;
  cuisineTypes?: string[];
  kitchenCapacity?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  zoneId: string;
}

interface CycleInfo {
  id: string;
  status: string;
  winningDishId?: string;
  dishes?: { id: string; name: string }[];
}

type PageState = "loading" | "no-auth" | "no-restaurant" | "ready";

export default function BidsPage() {
  const { user, token } = useAuth();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    pricePerPlate: "",
    prepTime: "",
    maxCapacity: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState("no-auth");
      return;
    }

    apiFetch<{ data: RestaurantData }>("/restaurants/mine")
      .then((res) => {
        setRestaurant(res.data);
        setPageState("ready");
        // Also try to fetch current cycle
        return apiFetch<{ data: CycleInfo }>("/cycles/today?zoneId=" + res.data.zoneId).catch(() => null);
      })
      .then((cycleRes) => {
        if (cycleRes) setCycle(cycleRes.data);
      })
      .catch((err) => {
        if (err.message.includes("404") || err.message.includes("not found") || err.message.includes("No restaurant")) {
          setPageState("no-restaurant");
        } else {
          setPageState("no-auth");
        }
      });
  }, [token]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!cycle || !restaurant) {
      setError("No active cycle to bid on.");
      return;
    }

    const dishId = cycle.winningDishId || cycle.dishes?.[0]?.id;
    if (!dishId) {
      setError("No dish available to bid on.");
      return;
    }

    try {
      await apiFetch("/bids", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: restaurant.id,
          dailyCycleId: cycle.id,
          dishId,
          pricePerPlate: parseFloat(formData.pricePerPlate),
          prepTime: parseInt(formData.prepTime),
          maxCapacity: parseInt(formData.maxCapacity),
          serviceFeeAccepted: true,
        }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Bid submission failed");
    }
  }

  if (pageState === "loading") {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "no-auth") {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8">
          <div className="rounded-lg border p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
            <p className="mb-6 text-muted-foreground">
              You need to sign in as a restaurant owner to access the bid dashboard.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "no-restaurant") {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-amber-900">
              Enrollment Required
            </h2>
            <p className="mb-6 text-amber-800">
              You need to register your restaurant before you can submit bids.
              Complete the enrollment form to get started.
            </p>
            <Link
              href="/enroll"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Enroll Your Restaurant
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cuisineTypes = restaurant?.cuisineTypes ?? [];
  const fullAddress = [restaurant?.address, restaurant?.city, restaurant?.state, restaurant?.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        {/* Restaurant Header */}
        <div className="mb-8 rounded-lg border bg-muted/30 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{restaurant?.name}</h1>
                {restaurant?.isVerified && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Verified
                  </span>
                )}
              </div>
              {fullAddress && (
                <p className="mt-1 text-sm text-muted-foreground">{fullAddress}</p>
              )}
            </div>
          </div>

          {cuisineTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cuisineTypes.map((c) => (
                <span
                  key={c}
                  className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            {restaurant?.capacity && (
              <span>Seating: {restaurant.capacity}</span>
            )}
            {restaurant?.kitchenCapacity && (
              <span>Kitchen: {restaurant.kitchenCapacity} plates/hr</span>
            )}
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold">Submit Your Bid</h2>
        <p className="mb-6 text-muted-foreground">
          Submit your bid to cook today&apos;s winning dish.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <h2 className="text-xl font-semibold text-green-800">Bid Submitted!</h2>
            <p className="mt-2 text-green-700">
              We&apos;ll notify you if your bid wins. Results at 2 PM.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-1 font-medium">Today&apos;s Winning Dish</h3>
              <p className="text-sm text-muted-foreground">
                {cycle?.status === "BIDDING"
                  ? cycle.dishes?.[0]?.name || "Loading dish..."
                  : "Check back during bidding phase (12-2 PM) to see the winning dish."}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="pricePerPlate" className="mb-1 block text-sm font-medium">
                  Price Per Plate ($)
                </label>
                <input
                  id="pricePerPlate"
                  name="pricePerPlate"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={formData.pricePerPlate}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="12.50"
                />
              </div>

              <div>
                <label htmlFor="prepTime" className="mb-1 block text-sm font-medium">
                  Prep Time (minutes)
                </label>
                <input
                  id="prepTime"
                  name="prepTime"
                  type="number"
                  min="1"
                  required
                  value={formData.prepTime}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="45"
                />
              </div>

              <div>
                <label htmlFor="maxCapacity" className="mb-1 block text-sm font-medium">
                  Max Plates You Can Serve
                </label>
                <input
                  id="maxCapacity"
                  name="maxCapacity"
                  type="number"
                  min="1"
                  required
                  value={formData.maxCapacity}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="serviceFee"
                type="checkbox"
                defaultChecked
                className="rounded border"
              />
              <label htmlFor="serviceFee" className="text-sm">
                I accept the 10% platform service fee
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Submit Bid
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
