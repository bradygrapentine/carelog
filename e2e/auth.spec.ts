import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  getOtpFromMailpit,
  uniqueEmail,
} from "./helpers";

test.beforeEach(async () => {
  await clearMailpit();
});

// TD-220: signIn() now mints OTPs via the GoTrue admin API (no email sent),
// which removed the recurring Mailpit timeout flake from every auth-gated spec.
// This ONE test still drives the REAL Supabase→Mailpit email delivery so that
// pipeline stays smoke-covered — if real OTP emails stop arriving, this fails.
test("real OTP email delivery (Mailpit coverage path)", async ({ page }) => {
  const email = uniqueEmail("auth-real-otp");
  await clearMailpit();
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /^Continue with email$/ }).click();
  await page
    .getByText("Check your email", { exact: false })
    .waitFor({ timeout: 30_000 });
  const otp = await getOtpFromMailpit(email);
  await page.getByPlaceholder("123456").fill(otp);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Verify code$/ }).click(),
  ]);
  await expect(page.getByText("Your care dashboard")).toBeVisible();
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
  const TEST_EMAIL = uniqueEmail("auth");
  await signIn(page, TEST_EMAIL);
  await expect(page.getByText("Your care dashboard")).toBeVisible();
});

test("sign out works", async ({ page }) => {
  const TEST_EMAIL = uniqueEmail("auth");
  await signIn(page, TEST_EMAIL);

  // The browser-native window.confirm wrapper from TD-65 was replaced
  // with a Radix <AlertDialog> in AppTabBar. The avatar button
  // (aria-label="Sign out") opens the modal; the actual sign-out fires
  // on the <AlertDialogAction> inside. Playwright `dialog` events only
  // capture native dialogs, so we drive the modal explicitly.
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(
    page.getByRole("alertdialog", { name: /sign out of caresync/i }),
  ).toBeVisible({ timeout: 5_000 });
  await Promise.all([
    page.waitForURL(/\/signin/, { timeout: 15_000 }),
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sign out" })
      .click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Sign in to CareSync" }),
  ).toBeVisible();
});
