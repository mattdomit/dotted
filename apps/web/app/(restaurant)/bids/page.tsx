"use client";

import { useState } from "react";

export default function BidsPage() {
  const [formData, setFormData] = useState({
    pricePerPlate: "",
    prepTime: "",
    maxCapacity: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: Implement actual bid submission with auth
    setSubmitted(true);
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="mb-2 text-3xl font-bold">Restaurant Bid Dashboard</h1>
      <p className="mb-8 text-muted-foreground">
        Submit your bid to cook today&apos;s winning dish.
      </p>

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
              Check back during bidding phase (12–2 PM) to see the winning dish.
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
  );
}
