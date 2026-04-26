// e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit } from "./helpers";

const EXISTING_EMAIL = "e2e-author@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Onboarding flow", () => {
  test("new user sees set-up CTA on dashboard", async ({ page }) => {
    // Unique email guarantees this user has never completed onboarding
    const freshEmail = `e2e-new-${Date.now()}@test.com`;
    await signIn(page, freshEmail);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(
      page.getByRole("link", { name: /Set up a care team/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("new user completes onboarding and lands on journal", async ({
    page,
  }) => {
    const freshEmail = `e2e-onboard-${Date.now()}@test.com`;
    await signIn(page, freshEmail);

    await page.click('a:has-text("Set up a care team")');
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });

    await page.fill('[name="recipientName"]', "E2E Test Person");
    await page.fill('[name="orgName"]', "E2E Test Family");
    await page.click('button[type="submit"]');

    // Onboarding redirects to /dashboard; care team is now visible
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await page.click('text="View care journal"');
    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("existing user with care team skips onboarding CTA", async ({
    page,
  }) => {
    await signIn(page, EXISTING_EMAIL);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    // Should see "View care journal" — not the onboarding CTA
    // (TD-51) Renders as <p> inside a clickable Card, not a <button>.
    await expect(page.locator('text="View care journal"')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("link", { name: /Set up a care team/i }),
    ).not.toBeVisible();
  });
});
