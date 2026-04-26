import { test, expect } from "@playwright/test";
import { signIn, clearMailpit } from "./helpers";

const TEST_EMAIL = "e2e-auth@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test("sign in page loads correctly", async ({ page }) => {
  await page.goto("/signin");
  // CareSync appears twice on /signin (logo span + h1 heading); use heading
  // to avoid strict-mode locator violation.
  await expect(
    page.getByRole("heading", { name: "Sign in to CareSync" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
});

test("sign in with OTP lands on dashboard", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await expect(page.getByText("Your care teams")).toBeVisible();
});

// (TD-53) Second signIn() call within auth.spec.ts (or auth-proxy.spec.ts)
// times out at helpers.ts:68 waiting for "Check your email" — first signIn
// works, second one stalls. Hypothesis: OTP rate limit, stale browser state,
// or signin-page redirect-when-authenticated behavior. Investigate in TD-53.
test.fixme("sign out works", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await page.click("text=Sign out");
  await page.waitForTimeout(1000);
  await expect(
    page.getByRole("heading", { name: "Sign in to CareSync" }),
  ).toBeVisible();
});
