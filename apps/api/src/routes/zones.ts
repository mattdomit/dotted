import { Router } from "express";
import { prisma } from "@dotted/db";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { cacheMiddleware } from "../middleware/cache";

export const zoneRouter = Router();

zoneRouter.get("/", cacheMiddleware(300, "zones"), async (_req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, city: true, state: true, dailyCycleConfig: true },
    });
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
});

zoneRouter.get("/:id", cacheMiddleware(120, "zone"), async (req, res, next) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { memberships: true, restaurants: true, suppliers: true } } },
    });
    if (!zone) throw new AppError("Zone not found", 404);
    res.json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
});

// GET /mine — get zones the authenticated user belongs to
zoneRouter.get("/mine", authenticate, async (req, res, next) => {
  try {
    const memberships = await prisma.zoneMembership.findMany({
      where: { userId: req.user!.userId },
      include: { zone: { select: { id: true, name: true, slug: true, city: true, state: true } } },
      orderBy: { joinedAt: "desc" },
    });
    res.json({ success: true, data: memberships.map((m) => m.zone) });
  } catch (err) {
    next(err);
  }
});

zoneRouter.post("/:id/join", authenticate, async (req, res, next) => {
  try {
    const zoneId = req.params.id as string;
    const userId = req.user!.userId;

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new AppError("Zone not found", 404);

    const membership = await prisma.zoneMembership.upsert({
      where: { userId_zoneId: { userId, zoneId: zoneId } },
      update: {},
      create: { userId, zoneId: zoneId },
    });
    res.json({ success: true, data: membership });
  } catch (err) {
    next(err);
  }
});
