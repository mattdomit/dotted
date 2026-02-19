import { prisma } from "@dotted/db";

export async function tallyVotes(cycleId: string): Promise<{ winningDishId: string; winningDishName: string; voteCount: number }> {
  const dishes = await prisma.dish.findMany({
    where: { dailyCycleId: cycleId },
    orderBy: { voteCount: "desc" },
  });

  if (dishes.length === 0) {
    throw new Error("No dishes found for this cycle");
  }

  const winner = dishes[0];

  // Update cycle with winning dish
  await prisma.dailyCycle.update({
    where: { id: cycleId },
    data: { winningDishId: winner.id },
  });

  return {
    winningDishId: winner.id,
    winningDishName: winner.name,
    voteCount: winner.voteCount,
  };
}

export async function getVoteResults(cycleId: string) {
  const dishes = await prisma.dish.findMany({
    where: { dailyCycleId: cycleId },
    select: { id: true, name: true, voteCount: true, cuisine: true },
    orderBy: { voteCount: "desc" },
  });

  const totalVotes = dishes.reduce((sum, d) => sum + d.voteCount, 0);

  return {
    dishes: dishes.map((d) => ({
      ...d,
      percentage: totalVotes > 0 ? Math.round((d.voteCount / totalVotes) * 100) : 0,
    })),
    totalVotes,
  };
}
