import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// (TD-73) Load apps/web/.env.local so e2e/helpers.ts can read
// SUPABASE_SERVICE_ROLE_KEY for the admin-link signIn bypass. CI sets
// this via repository secrets, so the file may not exist there.
try {
  const envPath = resolve(__dirname, "apps/web/.env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] && !process.env[m[1]])
      process.env[m[1]] = (m[2] ?? "").trim();
  }
} catch {
  // .env.local missing in CI — that's fine, env vars come from secrets.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
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
