import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { UserRole, CycleStatus } from "@dotted/shared";
import { cleanDatabase } from "./helpers/db";
import { createTestUser } from "./helpers/auth";
import { createTestZone, createTestCycle, createTestDishes, createTestSubscription, createTestRestaurant } from "./helpers/fixtures";
import { checkAndAwardAchievements, updateStreak, addLoyaltyPoints, getLeaderboard } from "../services/gamification";

describe("Gamification Service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("checkAndAwardAchievements", () => {
    it("awards first_vote badge", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 1);

      await prisma.vote.create({
        data: { userId: user.id, dishId: dishes[0].id, dailyCycleId: cycle.id },
      });

      const badges = await checkAndAwardAchievements(user.id);
      expect(badges).toContain("first_vote");
    });

    it("awards premium_member badge for subscribers", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await createTestSubscription(user.id, "PLUS");

      const badges = await checkAndAwardAchievements(user.id);
      expect(badges).toContain("premium_member");
    });

    it("does not award duplicate badges", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const zone = await createTestZone();
      const cycle = await createTestCycle(zone.id, CycleStatus.VOTING);
      const dishes = await createTestDishes(cycle.id, 1);

      await prisma.vote.create({
        data: { userId: user.id, dishId: dishes[0].id, dailyCycleId: cycle.id },
      });

      const badges1 = await checkAndAwardAchievements(user.id);
      expect(badges1).toContain("first_vote");

      const badges2 = await checkAndAwardAchievements(user.id);
      expect(badges2).not.toContain("first_vote");
    });

    it("awards five_day_streak badge", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      await prisma.user.update({
        where: { id: user.id },
        data: { streak: 5 },
      });

      const badges = await checkAndAwardAchievements(user.id);
      expect(badges).toContain("five_day_streak");
    });
  });

  describe("updateStreak", () => {
    it("starts streak at 1 for first activity", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const streak = await updateStreak(user.id);
      expect(streak).toBe(1);
    });

    it("increments streak for consecutive days", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await prisma.user.update({
        where: { id: user.id },
        data: { streak: 3, lastActiveDate: yesterday },
      });

      const streak = await updateStreak(user.id);
      expect(streak).toBe(4);
    });

    it("resets streak after missed day", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      await prisma.user.update({
        where: { id: user.id },
        data: { streak: 5, lastActiveDate: twoDaysAgo },
      });

      const streak = await updateStreak(user.id);
      expect(streak).toBe(1);
    });

    it("returns same streak if already active today", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.user.update({
        where: { id: user.id },
        data: { streak: 3, lastActiveDate: today },
      });

      const streak = await updateStreak(user.id);
      expect(streak).toBe(3);
    });
  });

  describe("addLoyaltyPoints", () => {
    it("adds points to user", async () => {
      const { user } = await createTestUser(UserRole.CONSUMER);

      const points = await addLoyaltyPoints(user.id, 10, "order");
      expect(points).toBe(10);

      const points2 = await addLoyaltyPoints(user.id, 5, "quality_score");
      expect(points2).toBe(15);
    });
  });

  describe("getLeaderboard", () => {
    it("returns leaderboard by points", async () => {
      const zone = await createTestZone();
      const { user: user1 } = await createTestUser(UserRole.CONSUMER);
      const { user: user2 } = await createTestUser(UserRole.CONSUMER);

      await prisma.zoneMembership.create({ data: { userId: user1.id, zoneId: zone.id } });
      await prisma.zoneMembership.create({ data: { userId: user2.id, zoneId: zone.id } });

      await prisma.user.update({ where: { id: user1.id }, data: { loyaltyPoints: 100 } });
      await prisma.user.update({ where: { id: user2.id }, data: { loyaltyPoints: 200 } });

      const leaderboard = await getLeaderboard(zone.id, "points");
      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].value).toBe(200);
      expect(leaderboard[1].value).toBe(100);
    });

    it("returns leaderboard by orders", async () => {
      const zone = await createTestZone();
      const { user } = await createTestUser(UserRole.CONSUMER);
      const { user: owner } = await createTestUser(UserRole.RESTAURANT_OWNER);
      const restaurant = await createTestRestaurant(owner.id, zone.id);

      await prisma.zoneMembership.create({ data: { userId: user.id, zoneId: zone.id } });

      const cycle = await createTestCycle(zone.id, CycleStatus.COMPLETED);
      const dishes = await createTestDishes(cycle.id, 1);
      await prisma.order.create({
        data: { userId: user.id, dailyCycleId: cycle.id, restaurantId: restaurant.id, quantity: 1, totalPrice: 15, status: "DELIVERED", items: { create: { dishId: dishes[0].id, quantity: 1, price: 15 } } },
      });

      const leaderboard = await getLeaderboard(zone.id, "orders");
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].value).toBe(1);
    });
  });
});
