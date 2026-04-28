// e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  ensureCareTeam,
  uniqueEmail,
  CARE_JOURNAL_LINK_SELECTOR,
} from "./helpers";

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
    await page.locator(CARE_JOURNAL_LINK_SELECTOR).first().click();
    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("existing user with care team skips onboarding CTA", async ({
    page,
  }) => {
    // (TD-73) Per-test fresh user; seed a team first so we can assert the
    // "has team" branch. ensureCareTeam runs onboarding if needed and lands
    // on /dashboard with the journal-link aria-label visible.
    const EXISTING_EMAIL = uniqueEmail("e2e-author");
    await signIn(page, EXISTING_EMAIL);
    await ensureCareTeam(page);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator(CARE_JOURNAL_LINK_SELECTOR).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("link", { name: /Set up a care team/i }),
    ).not.toBeVisible();
  });
});
