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

test("sign out works", async ({ page }) => {
  await signIn(page, TEST_EMAIL);

  // TD-65 wrapped sign-out in a window.confirm("Sign out of CareSync?")
  // dialog. Auto-accept it BEFORE the click — Playwright dialogs must be
  // handled by an event listener since they block synchronously.
  page.once("dialog", (dialog) => dialog.accept());

  // Wait for the URL flip rather than a fixed sleep; the redirect can
  // take >1s under the CI runner. Scope click by role + aria-label so
  // we don't match the CommandPalette "Sign out" command (which also
  // calls handleSignOut but isn't what this test exercises).
  await Promise.all([
    page.waitForURL(/\/signin/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Sign out" }).first().click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Sign in to CareSync" }),
  ).toBeVisible();
});
