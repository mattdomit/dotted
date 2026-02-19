import { Router } from "express";
import { prisma } from "@dotted/db";
import { AppError } from "../middleware/error-handler";

export const cycleRouter = Router();

cycleRouter.get("/today", async (req, res, next) => {
  try {
    const zoneId = req.query.zoneId as string;
    if (!zoneId) throw new AppError("zoneId query param required", 400);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cycle = await prisma.dailyCycle.findUnique({
      where: { zoneId_date: { zoneId, date: today } },
      include: {
        dishes: {
          include: { ingredients: true },
          orderBy: { voteCount: "desc" },
        },
      },
    });

    if (!cycle) throw new AppError("No cycle found for today", 404);
    res.json({ success: true, data: cycle });
  } catch (err) {
    next(err);
  }
});

cycleRouter.get("/:id", async (req, res, next) => {
  try {
    const cycle = await prisma.dailyCycle.findUnique({
      where: { id: req.params.id },
      include: {
        dishes: {
          include: { ingredients: true },
          orderBy: { voteCount: "desc" },
        },
        zone: { select: { name: true, slug: true } },
      },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
    res.json({ success: true, data: cycle });
  } catch (err) {
    next(err);
  }
});
