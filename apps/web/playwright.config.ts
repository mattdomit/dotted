import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  webServer: [
    {
      command: "pnpm --filter @dotted/api dev",
      port: 4000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://dotted:dotted@localhost:5432/dotted_test",
        JWT_SECRET: "test-secret",
        NODE_ENV: "test",
      },
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @dotted/web dev",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
      },
      timeout: 30_000,
    },
  ],
});
