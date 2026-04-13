// e2e/playwright.prod.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/navigation.spec.ts",
    "**/journal-detail.spec.ts",
    "**/dashboard-nav.spec.ts",
  ],
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 30000,
  reporter: "line",
  use: {
    baseURL: "https://care-log.org",
    storageState: ".playwright/session.json",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/setup/save-session.ts",
      use: { storageState: undefined },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: [],
    },
  ],
});
