"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  description: string | null;
  cuisineTypes: string[];
  capacity: number;
  kitchenCapacity: number;
  rating: number;
  website: string | null;
  createdAt: string;
}

export default function RestaurantProfilePage() {
  const { token } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiFetch<{ data: Restaurant }>("/restaurants/mine")
      .then((res) => setRestaurant(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container max-w-2xl py-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
          <Link href="/login" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Restaurant Profile</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="mb-4 text-muted-foreground">No restaurant found.</p>
            <Link href="/enroll" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Enroll Your Restaurant
            </Link>
          </div>
        ) : restaurant ? (
          <div className="space-y-6">
            <div className="rounded-lg border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{restaurant.name}</h2>
                  <p className="mt-1 text-muted-foreground">{restaurant.address}</p>
                  <p className="text-muted-foreground">{restaurant.city}, {restaurant.state} {restaurant.zipCode}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{restaurant.rating.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Contact</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Phone:</span> {restaurant.phone}</div>
                  <div><span className="text-muted-foreground">Email:</span> {restaurant.email}</div>
                  {restaurant.website && <div><span className="text-muted-foreground">Website:</span> {restaurant.website}</div>}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Kitchen Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Seating:</span> {restaurant.capacity}</div>
                  <div><span className="text-muted-foreground">Kitchen Capacity:</span> {restaurant.kitchenCapacity} plates/day</div>
                  <div><span className="text-muted-foreground">Cuisine:</span> {restaurant.cuisineTypes.join(", ")}</div>
                </div>
              </div>
            </div>

            {restaurant.description && (
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-semibold">Description</h3>
                <p className="text-sm text-muted-foreground">{restaurant.description}</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Enrolled on {new Date(restaurant.createdAt).toLocaleDateString()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
