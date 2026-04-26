import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  // 90s default — single-context tests (signIn + 1-2 navigations + assertions)
  // typically finish in 15-30s but the OTP poll can stretch to 10s on a cold
  // CI runner. Multi-context invite tests opt into 180s via test.setTimeout
  // (see e2e/burnout.spec.ts).
  timeout: 90_000,
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
