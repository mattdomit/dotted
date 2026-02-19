import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@dotted/db";
import { CycleStatus } from "@dotted/shared";
import { tallyVotes, getVoteResults } from "../../../services/voting";
import { cleanDatabase } from "../../helpers/db";
import { createTestZone, createTestCycle, createTestDishes } from "../../helpers/fixtures";

describe("Voting Service", () => {
  let zoneId: string;
  let cycleId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const zone = await createTestZone();
    zoneId = zone.id;
    const cycle = await createTestCycle(zoneId, CycleStatus.VOTING);
    cycleId = cycle.id;
  });

  describe("tallyVotes", () => {
    it("should select the dish with the highest vote count", async () => {
      const dishes = await createTestDishes(cycleId, 3);

      // Give the second dish the most votes
      await prisma.dish.update({ where: { id: dishes[0].id }, data: { voteCount: 3 } });
      await prisma.dish.update({ where: { id: dishes[1].id }, data: { voteCount: 7 } });
      await prisma.dish.update({ where: { id: dishes[2].id }, data: { voteCount: 2 } });

      const result = await tallyVotes(cycleId);

      expect(result.winningDishId).toBe(dishes[1].id);
      expect(result.winningDishName).toBe(dishes[1].name);
      expect(result.voteCount).toBe(7);
    });

    it("should update the cycle's winningDishId", async () => {
      const dishes = await createTestDishes(cycleId, 2);
      await prisma.dish.update({ where: { id: dishes[0].id }, data: { voteCount: 5 } });
      await prisma.dish.update({ where: { id: dishes[1].id }, data: { voteCount: 3 } });

      await tallyVotes(cycleId);

      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.winningDishId).toBe(dishes[0].id);
    });

    it("should throw when no dishes exist", async () => {
      await expect(tallyVotes(cycleId)).rejects.toThrow("No dishes found for this cycle");
    });

    it("should handle tie by using Prisma ordering (deterministic)", async () => {
      const dishes = await createTestDishes(cycleId, 3);
      await prisma.dish.update({ where: { id: dishes[0].id }, data: { voteCount: 5 } });
      await prisma.dish.update({ where: { id: dishes[1].id }, data: { voteCount: 5 } });
      await prisma.dish.update({ where: { id: dishes[2].id }, data: { voteCount: 2 } });

      const result = await tallyVotes(cycleId);

      // Should pick one of the tied dishes deterministically
      expect([dishes[0].id, dishes[1].id]).toContain(result.winningDishId);
      expect(result.voteCount).toBe(5);
    });
  });

  describe("getVoteResults", () => {
    it("should return correct percentages", async () => {
      const dishes = await createTestDishes(cycleId, 3);
      await prisma.dish.update({ where: { id: dishes[0].id }, data: { voteCount: 10 } });
      await prisma.dish.update({ where: { id: dishes[1].id }, data: { voteCount: 5 } });
      await prisma.dish.update({ where: { id: dishes[2].id }, data: { voteCount: 5 } });

      const result = await getVoteResults(cycleId);

      expect(result.totalVotes).toBe(20);
      expect(result.dishes).toHaveLength(3);

      // Find each dish's percentage
      const sorted = result.dishes.sort((a, b) => b.voteCount - a.voteCount);
      expect(sorted[0].percentage).toBe(50);
      expect(sorted[1].percentage).toBe(25);
      expect(sorted[2].percentage).toBe(25);
    });

    it("should return 0% for all when no votes", async () => {
      await createTestDishes(cycleId, 3);

      const result = await getVoteResults(cycleId);

      expect(result.totalVotes).toBe(0);
      result.dishes.forEach((d) => {
        expect(d.percentage).toBe(0);
      });
    });

    it("should return empty array when no dishes", async () => {
      const result = await getVoteResults(cycleId);

      expect(result.dishes).toHaveLength(0);
      expect(result.totalVotes).toBe(0);
    });

    it("should order dishes by voteCount descending", async () => {
      const dishes = await createTestDishes(cycleId, 3);
      await prisma.dish.update({ where: { id: dishes[0].id }, data: { voteCount: 2 } });
      await prisma.dish.update({ where: { id: dishes[1].id }, data: { voteCount: 8 } });
      await prisma.dish.update({ where: { id: dishes[2].id }, data: { voteCount: 5 } });

      const result = await getVoteResults(cycleId);

      expect(result.dishes[0].voteCount).toBe(8);
      expect(result.dishes[1].voteCount).toBe(5);
      expect(result.dishes[2].voteCount).toBe(2);
    });
  });
});
