"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface Achievement {
  id: string;
  badge: string;
  earnedAt: string;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  value: number;
}

const BADGE_INFO: Record<string, { label: string; description: string; icon: string }> = {
  first_vote: { label: "First Vote", description: "Cast your first vote", icon: "&#9745;" },
  first_order: { label: "First Order", description: "Place your first order", icon: "&#128230;" },
  first_review: { label: "First Review", description: "Write your first review", icon: "&#9997;" },
  ten_reviews: { label: "Critic", description: "Write 10 reviews", icon: "&#128221;" },
  five_day_streak: { label: "On Fire", description: "5-day activity streak", icon: "&#128293;" },
  quality_scorer: { label: "Quality Expert", description: "Submit 10 quality scores", icon: "&#11088;" },
  top_voter: { label: "Top Voter", description: "Cast 50 votes", icon: "&#127942;" },
  premium_member: { label: "Premium Member", description: "Subscribe to Premium", icon: "&#128142;" },
  variety_explorer: { label: "Food Explorer", description: "Order 10 different cuisines", icon: "&#127758;" },
  founding_member: { label: "Founding Member", description: "One of the first users", icon: "&#127775;" },
};

export default function AchievementsPage() {
  const { token, user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"badges" | "leaderboard">("badges");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<{ data: MeData }>("/subscriptions/me")
        .then((res) => {
          setPoints(res.data.loyaltyPoints);
          setStreak(res.data.streak);
        })
        .catch(() => {}),
      apiFetch<{ data: Achievement[] }>("/gamification/achievements")
        .then((res) => setAchievements(res.data))
        .catch(() => setAchievements([])),
      apiFetch<{ data: LeaderboardEntry[] }>("/gamification/leaderboard?metric=points")
        .then((res) => setLeaderboard(res.data))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [token]);

  const allBadges = Object.keys(BADGE_INFO);
  const earnedBadges = new Set(achievements.map((a) => a.badge));

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-3xl font-bold">Achievements</h1>
        <p className="mb-6 text-muted-foreground">
          Earn badges and loyalty points by participating in the Dotted community.
        </p>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">{points}</div>
            <div className="text-xs text-muted-foreground">Loyalty Points</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-xs text-muted-foreground">Day Streak</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">{earnedBadges.size}/{allBadges.length}</div>
            <div className="text-xs text-muted-foreground">Badges</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border p-1">
          {(["badges", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : tab === "badges" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {allBadges.map((badge) => {
              const info = BADGE_INFO[badge];
              const earned = earnedBadges.has(badge);
              const achievement = achievements.find((a) => a.badge === badge);
              return (
                <div
                  key={badge}
                  className={`rounded-lg border p-4 text-center transition-colors ${
                    earned ? "border-primary bg-primary/5" : "opacity-40"
                  }`}
                >
                  <div className="mb-2 text-3xl" dangerouslySetInnerHTML={{ __html: info.icon }} />
                  <div className="text-sm font-semibold">{info.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{info.description}</div>
                  {earned && achievement && (
                    <div className="mt-2 text-xs text-primary">
                      Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Points Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No leaderboard data yet.
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      entry.userId === user?.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? "bg-yellow-100 text-yellow-800" : i === 1 ? "bg-gray-100 text-gray-700" : i === 2 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                      <div className="font-medium">
                        {entry.userName}
                        {entry.userId === user?.id && <span className="ml-1 text-xs text-primary">(you)</span>}
                      </div>
                    </div>
                    <div className="text-lg font-bold">{entry.value} pts</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MeData {
  loyaltyPoints: number;
  streak: number;
}
