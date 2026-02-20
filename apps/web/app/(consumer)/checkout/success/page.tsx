"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

export default function CheckoutSuccessPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<string>("loading");

  useEffect(() => {
    if (!token || !sessionId) {
      setStatus("error");
      return;
    }

    apiFetch<{ data: { status: string } }>(`/payments/session/${sessionId}`)
      .then((res) => setStatus(res.data.status === "paid" || res.data.status === "complete" ? "success" : "pending"))
      .catch(() => setStatus("error"));
  }, [token, sessionId]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-md py-16 text-center">
        {status === "loading" ? (
          <p className="text-muted-foreground">Verifying payment...</p>
        ) : status === "success" ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Payment Successful!</h1>
            <p className="text-muted-foreground">
              Your order has been confirmed. The restaurant will start preparing your dish.
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View My Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Payment Status</h1>
            <p className="text-muted-foreground">
              {status === "pending"
                ? "Your payment is still processing. Please check back shortly."
                : "We couldn't verify your payment. Please check your orders page."}
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View My Orders
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
