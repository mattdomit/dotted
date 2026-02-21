"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role: string;
  dietaryPreferences: string[];
  badges: string[];
  reviewCount: number;
  postCount: number;
  createdAt: string;
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reviews" | "posts">("reviews");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: UserProfile }>(`/users/${id}/profile`)
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.message || "Profile not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-8 text-center text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-8 text-center text-muted-foreground">{error || "Profile not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">
              {profile.role.replace("_", " ")} · Joined {new Date(profile.createdAt).toLocaleDateString()}
            </p>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          </div>
        </div>

        {profile.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg border p-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.reviewCount}</div>
            <div className="text-xs text-muted-foreground">Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.postCount}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
        </div>

        {profile.dietaryPreferences.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Dietary Preferences</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.dietaryPreferences.map((pref) => (
                <span
                  key={pref}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {pref}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2 border-b">
          <button
            onClick={() => setTab("reviews")}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "reviews" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Reviews
          </button>
          <button
            onClick={() => setTab("posts")}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Posts
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {tab === "reviews" ? `${profile.reviewCount} review(s)` : `${profile.postCount} post(s)`}
        </div>
      </div>
    </div>
  );
}
