import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 60000,
  // Bail after 5 failures — small flake tolerance, but stop early enough
  // that trace.zip uploads quickly during CI-debug iteration rather than
  // running the full 176-test suite × 60s × 2 retries.
  maxFailures: 5,
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
