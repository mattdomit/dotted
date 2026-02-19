import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    fileParallelism: false,
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/ai/**", "src/middleware/**", "src/routes/**", "src/jobs/**"],
    },
  },
});
