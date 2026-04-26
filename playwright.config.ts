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
  //
  // (TD-48 v12 — TEMPORARY DIAGNOSTIC) Bumped to 100 to surface every
  // remaining test-rot failure in a single CI run instead of N serial
  // iterations. Trajectory before this push: 5 → 7 → 7 → 9 passing.
  // REVERT TO 1 (or 5 for normal flake tolerance) before this PR merges.
  maxFailures: 100,
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
