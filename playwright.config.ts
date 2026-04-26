import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 60000,
  // (TD-47) Bail after first failure so trace.zip uploads quickly during
  // CI-debug iteration. With 176 tests serial × 60s × 2 retries, a fully-
  // failing run takes hours and never uploads. Revert when E2E is green.
  maxFailures: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
