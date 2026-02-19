// IMPORTANT: Set DATABASE_URL BEFORE any imports that use Prisma
const TEST_DB_URL =
  process.env.DATABASE_URL?.replace(/\/[^/]+$/, "/dotted_test") ??
  "postgresql://dotted:dotted@localhost:5432/dotted_test";

process.env.DATABASE_URL = TEST_DB_URL;
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sync schema once before all tests run
beforeAll(async () => {
  try {
    const dbPkgPath = path.resolve(__dirname, "../../../../packages/db");
    execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd: dbPkgPath,
      stdio: "pipe",
      timeout: 30000,
    });
  } catch (e: any) {
    console.error("Failed to push schema to test DB:", e.stderr?.toString() || e.message);
    // Don't throw — schema may already be in sync
  }
});

afterAll(async () => {
  const { prisma } = await import("@dotted/db");
  await prisma.$disconnect();
});
