"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

export default function CheckoutPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !orderId) {
      setLoading(false);
      return;
    }

    apiFetch<{ data: { checkoutUrl?: string; devMode?: boolean; order?: { id: string } } }>(
      "/payments/create-checkout-session",
      {
        method: "POST",
        body: JSON.stringify({ orderId }),
      }
    )
      .then((res) => {
        if (res.data.devMode) {
          // Dev mode — order auto-confirmed, redirect to orders
          router.push("/orders");
        } else if (res.data.checkoutUrl) {
          window.location.href = res.data.checkoutUrl;
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to create checkout session");
        setLoading(false);
      });
  }, [token, orderId, router]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-md py-16 text-center">
        {error ? (
          <div className="rounded-lg border border-destructive p-8">
            <h2 className="mb-2 text-xl font-bold text-destructive">Payment Error</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => router.push("/orders")}
              className="mt-4 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to Orders
            </button>
          </div>
        ) : loading ? (
          <div>
            <div className="mb-4 text-lg font-semibold">Redirecting to payment...</div>
            <p className="text-sm text-muted-foreground">
              You will be redirected to the secure payment page.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground">
              Missing order information. Please go back to your orders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
