import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, uniqueEmail } from "./helpers";

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
