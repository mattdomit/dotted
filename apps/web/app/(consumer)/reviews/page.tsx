"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface RestaurantOption {
  id: string;
  name: string;
  address: string;
  rating: number;
}

interface ReviewData {
  id: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  user?: { name: string; avatarUrl?: string };
  restaurant?: { name: string };
}

interface ReviewsResponse {
  reviews: ReviewData[];
  averageRating: number;
  total: number;
}

export default function ReviewsPage() {
  const { token } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    restaurantId: "",
    orderId: "",
    rating: 5,
    title: "",
    body: "",
  });

  useEffect(() => {
    apiFetch<{ data: RestaurantOption[] }>("/restaurants")
      .then((res) => setRestaurants(res.data))
      .catch(() => {});
  }, []);

  async function fetchReviews(rid: string) {
    setLoading(true);
    setError("");
    try {
      const json = await apiFetch<{ data: ReviewsResponse }>(
        `/reviews/restaurant/${rid}`
      );
      const data = json.data;
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setTotal(data.total);
      setSelectedRestaurantId(rid);
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }

  function handleBrowseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const rid = e.target.value;
    if (rid) {
      fetchReviews(rid);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rating" ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("You must be signed in to post a review.");
      return;
    }

    try {
      const payload = {
        ...formData,
        orderId: formData.orderId || undefined,
      };
      await apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess("Review posted successfully!");
      setFormData({ restaurantId: "", orderId: "", rating: 5, title: "", body: "" });
      setShowForm(false);
      if (selectedRestaurantId === formData.restaurantId) {
        fetchReviews(selectedRestaurantId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to post review.");
    }
  }

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={i < rating ? "text-yellow-500" : "text-gray-300"}
      >
        ★
      </span>
    ));
  }

  const selectedRestaurantName =
    restaurants.find((r) => r.id === selectedRestaurantId)?.name || "";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Restaurant Reviews</h1>
            <p className="mt-1 text-muted-foreground">
              Read and share your dining experiences.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? "Cancel" : "Write a Review"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        {showForm && (
          <div className="mb-8 rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Write a Review</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="review-restaurantId" className="mb-1 block text-sm font-medium">
                  Restaurant
                </label>
                <select
                  id="review-restaurantId"
                  name="restaurantId"
                  required
                  value={formData.restaurantId}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a restaurant...</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-rating" className="mb-1 block text-sm font-medium">
                  Rating
                </label>
                <select
                  id="review-rating"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)}{"☆".repeat(5 - n)} ({n})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-title" className="mb-1 block text-sm font-medium">
                  Title
                </label>
                <input
                  id="review-title"
                  name="title"
                  required
                  minLength={3}
                  maxLength={200}
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Great experience!"
                />
              </div>
              <div>
                <label htmlFor="review-body" className="mb-1 block text-sm font-medium">
                  Review
                </label>
                <textarea
                  id="review-body"
                  name="body"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  value={formData.body}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Tell others about your experience..."
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Post Review
              </button>
            </form>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="browse-restaurant" className="mb-1 block text-sm font-medium">
            Browse reviews by restaurant
          </label>
          <select
            id="browse-restaurant"
            value={selectedRestaurantId}
            onChange={handleBrowseChange}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a restaurant...</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.address}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-muted-foreground">Loading reviews...</p>}

        {!loading && selectedRestaurantId && (
          <>
            <div className="mb-6 flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
              <div className="text-3xl font-bold">{averageRating}</div>
              <div>
                <div className="text-lg">{renderStars(Math.round(averageRating))}</div>
                <p className="text-sm text-muted-foreground">
                  {total} review{total !== 1 ? "s" : ""} for {selectedRestaurantName}
                </p>
              </div>
            </div>

            {reviews.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No reviews yet. Be the first to review!
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {review.user?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="text-sm font-medium">
                          {review.user?.name || "Anonymous"}
                        </span>
                      </div>
                      <div className="text-sm">{renderStars(review.rating)}</div>
                    </div>
                    <h3 className="mt-2 font-semibold">{review.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !selectedRestaurantId && (
          <p className="text-center text-muted-foreground">
            Select a restaurant above to view reviews, or write your own review.
          </p>
        )}
      </div>
    </div>
  );
}
