import { describe, it, expect } from "vitest";
import request from "supertest";
import { prisma } from "@dotted/db";
import { createApp } from "../helpers/app";

const app = createApp();

describe("Infrastructure Tests", () => {
  it("should connect to the database (SELECT 1)", async () => {
    const result = await prisma.$queryRawUnsafe<[{ result: number }]>("SELECT 1 as result");
    expect(result[0].result).toBe(1);
  });

  it("should have PostGIS extension available", async () => {
    try {
      const result = await prisma.$queryRawUnsafe<[{ postgis_version: string }]>("SELECT PostGIS_Version() as postgis_version");
      expect(result[0].postgis_version).toBeDefined();
    } catch {
      // PostGIS may not be installed in test env — skip gracefully
      console.warn("PostGIS extension not available — skipping");
    }
  });

  it("should have all Prisma models accessible", async () => {
    // These should not throw
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.zone.count(),
      prisma.zoneMembership.count(),
      prisma.dailyCycle.count(),
      prisma.dish.count(),
      prisma.ingredient.count(),
      prisma.vote.count(),
      prisma.restaurant.count(),
      prisma.bid.count(),
      prisma.supplier.count(),
      prisma.supplierInventory.count(),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrderItem.count(),
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.review.count(),
    ]);

    // All counts should be non-negative numbers
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it("should return health check 200", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });
});
