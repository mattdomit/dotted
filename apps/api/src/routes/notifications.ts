import { Router } from "express";
import { prisma } from "@dotted/db";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";

export const notificationRouter = Router();

// GET / — list notifications for authenticated user
notificationRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
});

// GET /unread-count — get count of unread notifications
notificationRouter.get("/unread-count", authenticate, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/read — mark notification as read
notificationRouter.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    const notifId = req.params.id as string;
    const notification = await prisma.notification.findUnique({
      where: { id: notifId },
    });
    if (!notification) throw new AppError("Notification not found", 404);
    if (notification.userId !== req.user!.userId) throw new AppError("Unauthorized", 403);

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { readAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
