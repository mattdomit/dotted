import { Router } from "express";
import { UserRole } from "@dotted/shared";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import {
  getZoneAnalytics,
  getRevenueBreakdown,
  getDemandForecast,
  getWasteReport,
} from "../services/analytics";

export const analyticsRouter = Router();

// GET /zone/:id — zone performance analytics
analyticsRouter.get("/zone/:id", authenticate, async (req, res, next) => {
  try {
    const zoneId = req.params.id as string;
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const dateRange = start && end ? { start, end } : undefined;

    const analytics = await getZoneAnalytics(zoneId, dateRange);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

// GET /revenue — revenue breakdown (admin only)
analyticsRouter.get("/revenue", authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const dateRange = start && end ? { start, end } : undefined;

    const breakdown = await getRevenueBreakdown(dateRange);
    res.json({ success: true, data: breakdown });
  } catch (err) {
    next(err);
  }
});

// GET /forecast/:id — demand forecast for zone
analyticsRouter.get("/forecast/:id", authenticate, async (req, res, next) => {
  try {
    const zoneId = req.params.id as string;
    const days = parseInt(req.query.days as string) || 30;
    const forecast = await getDemandForecast(zoneId, days);
    res.json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
});

// GET /waste — waste report (admin only)
analyticsRouter.get("/waste", authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const zoneId = req.query.zoneId as string;
    if (!zoneId) throw new AppError("zoneId query parameter required", 400);

    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const dateRange = start && end ? { start, end } : undefined;

    const report = await getWasteReport(zoneId, dateRange);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});
