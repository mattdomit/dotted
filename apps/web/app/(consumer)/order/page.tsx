"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface CycleData {
  id: string;
  status: string;
  winningDishId: string;
  winningBidId: string;
  dishes: { id: string; name: string; description: string; cuisine: string; estimatedCost: number }[];
}

interface BidData {
  id: string;
  pricePerPlate: number;
  restaurantId: string;
  restaurant: { name: string; address: string };
}

export default function OrderPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get("cycleId");

  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [bid, setBid] = useState<BidData | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState("PICKUP");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token || !cycleId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const cycleRes = await apiFetch<{ data: CycleData }>(`/cycles/${cycleId}`);
        setCycle(cycleRes.data);

        if (cycleRes.data.status !== "ORDERING") {
          setError("Orders are not currently open for this cycle.");
          return;
        }

        // Fetch winning bid for pricing and restaurant info
        const bidRes = await apiFetch<{ data: BidData }>(`/bids/${cycleId}/winner`);
        setBid(bidRes.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token, cycleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cycle || !bid) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          dailyCycleId: cycle.id,
          restaurantId: bid.restaurantId,
          quantity,
          fulfillmentType,
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
          <p className="mb-6 text-muted-foreground">Sign in to place an order.</p>
          <Link href="/login" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!cycleId) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">No Cycle Selected</h2>
          <p className="mb-6 text-muted-foreground">Go to the daily cycle page to place an order when ordering is open.</p>
          <Link href="/cycle" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            View Cycle
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8 text-center">
          <div className="mb-4 text-4xl">&#10003;</div>
          <h2 className="mb-2 text-2xl font-bold">Order Placed!</h2>
          <p className="mb-6 text-muted-foreground">Your order has been confirmed. Track it on your orders page.</p>
          <div className="flex flex-col items-center gap-3">
            <Link href="/orders" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              View My Orders
            </Link>
            <Link href="/quality" className="text-sm text-muted-foreground hover:text-foreground">
              Rate a past order &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const winningDish = cycle?.dishes?.find((d) => d.id === cycle.winningDishId);
  const totalPrice = bid ? bid.pricePerPlate * quantity : 0;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Place Your Order</h1>
        <p className="mb-8 text-muted-foreground">Order today&apos;s winning dish.</p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : cycle && bid && winningDish ? (
          <form onSubmit={handleSubmit}>
            {/* Dish info */}
            <div className="mb-6 rounded-lg border p-5">
              <h3 className="text-lg font-semibold">{winningDish.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{winningDish.description}</p>
              <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
                <span>{winningDish.cuisine}</span>
              </div>
            </div>

            {/* Restaurant */}
            <div className="mb-6 rounded-lg border p-5">
              <div className="text-sm text-muted-foreground">Prepared by</div>
              <div className="font-semibold">{bid.restaurant.name}</div>
              <div className="text-sm text-muted-foreground">{bid.restaurant.address}</div>
              <div className="mt-2 text-lg font-bold">${bid.pricePerPlate.toFixed(2)} / plate</div>
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">Quantity</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="rounded-md border px-3 py-1 text-lg hover:bg-muted">-</button>
                <span className="text-xl font-bold">{quantity}</span>
                <button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} className="rounded-md border px-3 py-1 text-lg hover:bg-muted">+</button>
              </div>
            </div>

            {/* Fulfillment */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">Fulfillment Type</label>
              <div className="flex gap-3">
                {["PICKUP", "DELIVERY"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFulfillmentType(type)}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      fulfillmentType === type ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="mb-6 rounded-lg border bg-muted/50 p-5">
              <div className="flex justify-between text-lg">
                <span>Total</span>
                <span className="font-bold">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {quantity} plate(s) x ${bid.pricePerPlate.toFixed(2)}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Placing Order..." : "Place Order"}
            </button>
          </form>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">Unable to load order details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
