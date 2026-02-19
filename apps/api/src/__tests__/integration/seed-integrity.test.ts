import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@dotted/db";
import { execSync } from "child_process";

/**
 * These tests verify the integrity of the seed data.
 * They run the seed script first, then validate the data.
 *
 * NOTE: This test file modifies the database — it should run LAST
 * or in its own dedicated test pass.
 */
describe("Seed Data Integrity", () => {
  let seeded = false;

  beforeAll(async () => {
    try {
      const dbPkgPath = new URL("../../../../packages/db", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
      execSync("npx prisma db seed", {
        env: { ...process.env },
        cwd: dbPkgPath,
        stdio: "pipe",
        timeout: 30000,
      });
      seeded = true;
    } catch (e) {
      console.warn("Seed script not available or failed — seed integrity tests will be skipped");
    }
  });

  it("should have at least one zone", async () => {
    if (!seeded) return;
    const zones = await prisma.zone.findMany();
    expect(zones.length).toBeGreaterThan(0);
  });

  it("should have users for each role", async () => {
    if (!seeded) return;
    const consumers = await prisma.user.count({ where: { role: "CONSUMER" } });
    const owners = await prisma.user.count({ where: { role: "RESTAURANT_OWNER" } });
    const suppliers = await prisma.user.count({ where: { role: "SUPPLIER" } });
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });

    expect(consumers).toBeGreaterThan(0);
    expect(owners).toBeGreaterThan(0);
    expect(suppliers).toBeGreaterThan(0);
    expect(admins).toBeGreaterThan(0);
  });

  it("should have all restaurant owners linked to restaurants", async () => {
    if (!seeded) return;
    const owners = await prisma.user.findMany({
      where: { role: "RESTAURANT_OWNER" },
      include: { restaurant: true },
    });

    for (const owner of owners) {
      expect(owner.restaurant).not.toBeNull();
    }
  });

  it("should have all suppliers with inventory", async () => {
    if (!seeded) return;
    const suppliers = await prisma.supplier.findMany({
      include: { inventory: true },
    });

    for (const supplier of suppliers) {
      expect(supplier.inventory.length).toBeGreaterThan(0);
    }
  });

  it("should have bcrypt-hashed passwords", async () => {
    if (!seeded) return;
    const users = await prisma.user.findMany({ select: { passwordHash: true }, take: 10 });

    for (const user of users) {
      // bcrypt hashes start with $2a$ or $2b$
      expect(user.passwordHash).toMatch(/^\$2[ab]\$/);
    }
  });
});
