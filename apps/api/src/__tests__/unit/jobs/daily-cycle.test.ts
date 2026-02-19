import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma, CycleStatus } from "@dotted/db";
import { cleanDatabase } from "../../helpers/db";
import { createTestZone, createTestCycle } from "../../helpers/fixtures";

// Mock dependencies
vi.mock("../../../ai/dish-generator", () => ({
  generateDishSuggestions: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../services/voting", () => ({
  tallyVotes: vi.fn().mockResolvedValue({ winningDishId: "d1", winningDishName: "Test", voteCount: 5 }),
}));
vi.mock("../../../services/bidding", () => ({
  scoreBidsAndSelectWinner: vi.fn().mockResolvedValue({ winnerId: "b1", restaurantName: "Test Rest", score: 0.9 }),
}));
vi.mock("../../../ai/supplier-matcher", () => ({
  optimizeSourcing: vi.fn().mockResolvedValue([]),
}));

const mockEmit = vi.fn();
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
vi.mock("../../../socket/handlers", () => ({
  getIO: vi.fn().mockReturnValue({ to: mockTo }),
}));

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));

const { triggerCyclePhase, initCronJobs, runDailyCycleForAllZones } = await import("../../../jobs/daily-cycle");
const { generateDishSuggestions } = await import("../../../ai/dish-generator");
const { tallyVotes } = await import("../../../services/voting");
const { scoreBidsAndSelectWinner } = await import("../../../services/bidding");
const { optimizeSourcing } = await import("../../../ai/supplier-matcher");
const cron = await import("node-cron");

describe("Daily Cycle Jobs", () => {
  let zoneId: string;
  let cycleId: string;

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();

    const zone = await createTestZone();
    zoneId = zone.id;
    const cycle = await createTestCycle(zoneId, CycleStatus.SUGGESTING);
    cycleId = cycle.id;
  });

  describe("triggerCyclePhase", () => {
    it("should transition to VOTING and call generateDishSuggestions", async () => {
      await triggerCyclePhase(cycleId, CycleStatus.VOTING);

      expect(generateDishSuggestions).toHaveBeenCalledWith(zoneId, cycleId);
      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("VOTING");
    });

    it("should emit socket event on VOTING transition", async () => {
      await triggerCyclePhase(cycleId, CycleStatus.VOTING);

      expect(mockTo).toHaveBeenCalledWith(`cycle:${cycleId}`);
      expect(mockEmit).toHaveBeenCalledWith("cycle:status", { cycleId, status: "VOTING" });
    });

    it("should transition to BIDDING and call tallyVotes", async () => {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "VOTING" } });

      await triggerCyclePhase(cycleId, CycleStatus.BIDDING);

      expect(tallyVotes).toHaveBeenCalledWith(cycleId);
      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("BIDDING");
    });

    it("should transition to SOURCING and call scoreBidsAndSelectWinner + optimizeSourcing", async () => {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "BIDDING" } });

      await triggerCyclePhase(cycleId, CycleStatus.SOURCING);

      expect(scoreBidsAndSelectWinner).toHaveBeenCalledWith(cycleId);
      expect(optimizeSourcing).toHaveBeenCalledWith(cycleId);
      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("SOURCING");
    });

    it("should transition to ORDERING (status update only)", async () => {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "SOURCING" } });

      await triggerCyclePhase(cycleId, CycleStatus.ORDERING);

      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("ORDERING");
      expect(mockEmit).toHaveBeenCalledWith("cycle:status", { cycleId, status: "ORDERING" });
    });

    it("should transition to COMPLETED (status update only)", async () => {
      await prisma.dailyCycle.update({ where: { id: cycleId }, data: { status: "ORDERING" } });

      await triggerCyclePhase(cycleId, CycleStatus.COMPLETED);

      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("COMPLETED");
    });

    it("should transition to CANCELLED", async () => {
      await triggerCyclePhase(cycleId, CycleStatus.CANCELLED);

      const cycle = await prisma.dailyCycle.findUnique({ where: { id: cycleId } });
      expect(cycle!.status).toBe("CANCELLED");
    });

    it("should throw when cycle not found", async () => {
      await expect(triggerCyclePhase("nonexistent-id", CycleStatus.VOTING)).rejects.toThrow("Cycle not found");
    });
  });

  describe("initCronJobs", () => {
    it("should register 5 cron schedules", () => {
      initCronJobs();

      expect(cron.default.schedule).toHaveBeenCalledTimes(5);
    });

    it("should register schedules at the correct times", () => {
      initCronJobs();

      const calls = (cron.default.schedule as any).mock.calls;
      const schedules = calls.map((c: any) => c[0]);

      expect(schedules).toContain("0 6 * * *");   // 6 AM
      expect(schedules).toContain("0 12 * * *");  // 12 PM
      expect(schedules).toContain("0 14 * * *");  // 2 PM
      expect(schedules).toContain("0 17 * * *");  // 5 PM
      expect(schedules).toContain("30 21 * * *"); // 9:30 PM
    });
  });
});
