// e2e/auth-proxy.spec.ts  (ON-02)
// Regression guard for apps/web/proxy.ts — ensures OTP sign-in lands on /dashboard
// and does not redirect-loop back to /signin.
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit } from "./helpers";

const COORDINATOR_EMAIL = "e2e-proxy@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Auth proxy redirect behaviour", () => {
  test("OTP sign-in lands on /dashboard, not back on /signin", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    // signIn already asserts waitForURL(/\/dashboard/) internally;
    // this assertion is an explicit regression check on the final settled URL.
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test("URL never reverts to /signin after successful auth", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);

    // Snapshot the URL right after dashboard load.
    const urlAfterLogin = page.url();
    expect(urlAfterLogin).toMatch(/\/dashboard/);

    // Wait briefly then assert no redirect loop occurred.
    // If proxy.ts were broken it would redirect getUser() failures back to /signin.
    await page.waitForTimeout(1000);
    expect(page.url()).not.toMatch(/\/signin/);
    expect(page.url()).toMatch(/\/dashboard/);
  });
});
