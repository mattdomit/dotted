import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const dbDir = path.resolve(__dirname, "../../../packages/db");
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://dotted:dotted@localhost:5432/dotted_test",
  };

  console.log("[e2e] Pushing Prisma schema to test database...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: dbDir,
    env,
    stdio: "inherit",
  });

  console.log("[e2e] Seeding test database...");
  execSync("npx tsx prisma/seed.ts", {
    cwd: dbDir,
    env,
    stdio: "inherit",
  });

  console.log("[e2e] Global setup complete.");
}
