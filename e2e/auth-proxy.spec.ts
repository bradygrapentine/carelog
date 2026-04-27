// e2e/auth-proxy.spec.ts  (ON-02)
// Regression guard for apps/web/proxy.ts — ensures OTP sign-in lands on /dashboard
// and does not redirect-loop back to /signin.
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, uniqueEmail } from "./helpers";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Auth proxy redirect behaviour", () => {
  test("OTP sign-in lands on /dashboard, not back on /signin", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("proxy");
    await signIn(page, COORDINATOR_EMAIL);
    // signIn already asserts waitForURL(/\/dashboard/) internally;
    // this assertion is an explicit regression check on the final settled URL.
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test("URL never reverts to /signin after successful auth", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("proxy");
    await signIn(page, COORDINATOR_EMAIL);

    // Snapshot the URL right after dashboard load.
    expect(page.url()).toMatch(/\/dashboard/);

    // Poll for ~3s instead of sleeping a fixed 1s — under the CI runner the
    // settled URL can flicker briefly, and a static sleep races against
    // hydration. expect().toHaveURL retries until the assertion stabilises
    // OR fails outright (the regression we're guarding against).
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 3_000 });
    await expect(page).not.toHaveURL(/\/signin/, { timeout: 3_000 });
  });
});
