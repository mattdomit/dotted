import { prisma } from "@dotted/db";
import { BADGES_V2 } from "@dotted/shared";
import { logger } from "../lib/logger";

export async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  const newBadges: string[] = [];

  const [
    voteCount,
    reviewCount,
    orderCount,
    postCount,
    qualityScoreCount,
    helpfulVoteCount,
    user,
    existingBadges,
  ] = await Promise.all([
    prisma.vote.count({ where: { userId } }),
    prisma.review.count({ where: { userId } }),
    prisma.order.count({ where: { userId } }),
    prisma.zonePost.count({ where: { userId } }),
    prisma.qualityScore.count({ where: { userId } }),
    prisma.reviewVote.count({ where: { review: { userId }, helpful: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streak: true, subscriptionTier: true, createdAt: true },
    }),
    prisma.achievement.findMany({
      where: { userId },
      select: { badge: true },
    }),
  ]);

  const hasBadge = new Set(existingBadges.map((a) => a.badge));

  const checks: [string, boolean][] = [
    ["first_vote", voteCount >= 1],
    ["first_review", reviewCount >= 1],
    ["ten_reviews", reviewCount >= 10],
    ["helpful_reviewer", helpfulVoteCount >= 10],
    ["community_contributor", postCount >= 10],
    ["five_day_streak", (user?.streak ?? 0) >= 5],
    ["quality_scorer", qualityScoreCount >= 10],
    ["top_voter", voteCount >= 20],
    ["premium_member", user?.subscriptionTier === "PLUS" || user?.subscriptionTier === "PREMIUM"],
  ];

  // Variety explorer: voted for 10 different cuisines
  const cuisineVotes = await prisma.vote.findMany({
    where: { userId },
    include: { dish: { select: { cuisine: true } } },
  });
  const uniqueCuisines = new Set(cuisineVotes.map((v) => v.dish.cuisine.toLowerCase()));
  checks.push(["variety_explorer", uniqueCuisines.size >= 10]);

  // Founding member: joined within first 30 days of zone
  if (user) {
    const membership = await prisma.zoneMembership.findFirst({
      where: { userId },
      include: { zone: { select: { createdAt: true } } },
      orderBy: { joinedAt: "asc" },
    });
    if (membership) {
      const daysSinceZoneCreated =
        (membership.joinedAt.getTime() - membership.zone.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      checks.push(["founding_member", daysSinceZoneCreated <= 30]);
    }
  }

  for (const [badge, condition] of checks) {
    if (condition && !hasBadge.has(badge)) {
      await prisma.achievement.create({
        data: { userId, badge },
      });
      newBadges.push(badge);
      logger.info({ userId, badge }, "Achievement awarded");
    }
  }

  return newBadges;
}

export async function updateStreak(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, lastActiveDate: true },
  });

  if (!user) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (user.lastActiveDate) {
    const lastActive = new Date(user.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already active today
      return user.streak;
    } else if (diffDays === 1) {
      // Consecutive day
      const newStreak = user.streak + 1;
      await prisma.user.update({
        where: { id: userId },
        data: { streak: newStreak, lastActiveDate: today },
      });
      return newStreak;
    } else {
      // Streak broken
      await prisma.user.update({
        where: { id: userId },
        data: { streak: 1, lastActiveDate: today },
      });
      return 1;
    }
  }

  // First activity
  await prisma.user.update({
    where: { id: userId },
    data: { streak: 1, lastActiveDate: today },
  });
  return 1;
}

export async function addLoyaltyPoints(
  userId: string,
  points: number,
  _reason: string
): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { loyaltyPoints: { increment: points } },
    select: { loyaltyPoints: true },
  });
  return user.loyaltyPoints;
}

export async function getLeaderboard(
  zoneId: string,
  metric: "points" | "orders" | "quality" = "points"
) {
  const members = await prisma.zoneMembership.findMany({
    where: { zoneId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);

  if (metric === "points") {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, loyaltyPoints: true, avatarUrl: true },
      orderBy: { loyaltyPoints: "desc" },
      take: 20,
    });
    return users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      value: u.loyaltyPoints,
    }));
  }

  if (metric === "orders") {
    const orderCounts = await prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: { not: "CANCELLED" } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const userMap = new Map(
      (await prisma.user.findMany({
        where: { id: { in: orderCounts.map((o) => o.userId) } },
        select: { id: true, name: true, avatarUrl: true },
      })).map((u) => [u.id, u])
    );

    return orderCounts.map((o, i) => ({
      rank: i + 1,
      userId: o.userId,
      name: userMap.get(o.userId)?.name ?? "Unknown",
      avatarUrl: userMap.get(o.userId)?.avatarUrl,
      value: o._count.id,
    }));
  }

  // quality
  const qualityCounts = await prisma.qualityScore.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _avg: { overall: true },
    _count: { id: true },
    orderBy: { _avg: { overall: "desc" } },
    take: 20,
  });

  const userMap = new Map(
    (await prisma.user.findMany({
      where: { id: { in: qualityCounts.map((q) => q.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    })).map((u) => [u.id, u])
  );

  return qualityCounts.map((q, i) => ({
    rank: i + 1,
    userId: q.userId,
    name: userMap.get(q.userId)?.name ?? "Unknown",
    avatarUrl: userMap.get(q.userId)?.avatarUrl,
    value: q._avg.overall ?? 0,
  }));
}
