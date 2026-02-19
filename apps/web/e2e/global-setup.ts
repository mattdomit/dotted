import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "../../..");
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://dotted:dotted@localhost:5432/dotted_test",
  };

  console.log("[e2e] Pushing Prisma schema to test database...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.join(rootDir, "packages/db"),
    env,
    stdio: "inherit",
  });

  console.log("[e2e] Seeding test database...");
  execSync("pnpm --filter @dotted/db db:seed", {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });

  console.log("[e2e] Global setup complete.");
}
