"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "Pescatarian",
  "Keto",
  "Low-Sodium",
  "Low-Sugar",
  "Paleo",
];

export default function PreferencesPage() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: { id: string; email: string; dietaryPreferences: string[] } }>("/auth/me")
      .then((res) => {
        const prefs = res.data.dietaryPreferences;
        if (Array.isArray(prefs)) setSelected(prefs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/users/me/dietary", {
        method: "PATCH",
        body: JSON.stringify({ dietaryPreferences: selected }),
      });
      setSuccess("Preferences saved!");
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="text-3xl font-bold">Dietary Preferences</h1>
        <p className="mt-1 text-muted-foreground">
          Select your dietary needs — the AI chef will consider these when suggesting dishes.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        {success && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
        )}

        {loading ? (
          <p className="mt-6 text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {DIETARY_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                    selected.includes(option)
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
