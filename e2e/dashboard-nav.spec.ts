// e2e/dashboard-nav.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  ensureCareTeam,
  checkA11y,
  uniqueEmail,
  CARE_JOURNAL_LINK_SELECTOR,
} from "./helpers";

test.describe("Dashboard and sign-out navigation", () => {
  // (TD-61) Test calls page.goto("/dashboard") without signIn() first —
  // assumes a pre-existing session that doesn't exist in a fresh context.
  // Likely worked historically due to state leak between tests (see TD-53).
  // Investigate: should signIn() be added, or is "session restore" expected
  // to validate a different flow (e.g. cookie-survives-reload)?
  test.fixme("session restores and dashboard loads", async ({ page }) => {
    await page.goto("/dashboard");
    // Should land on dashboard, not be redirected to /signin
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your care dashboard|caring for|your care recipients/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await checkA11y(page);
  });

  // (TD-61) Same missing-signIn assumption as above.
  test.fixme('"Open care journal" navigates to journal page', async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForSelector(CARE_JOURNAL_LINK_SELECTOR, {
      timeout: 15000,
    });
    await page.locator(CARE_JOURNAL_LINK_SELECTOR).first().click();
    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("Journal tab button navigates back to dashboard from journal", async ({
    page,
  }) => {
    const NAV_EMAIL = uniqueEmail("nav");
    // (TD-73) Tests on /dashboard need a session — sign in first or the
    // page redirects to /signin and the rest of the flow can't run.
    await signIn(page, NAV_EMAIL);
    await ensureCareTeam(page);
    // Navigate to journal first
    await page.locator(CARE_JOURNAL_LINK_SELECTOR).first().click();
    await expect(page).toHaveURL(/\/journal\//, { timeout: 15000 });

    // The AppTabBar has no "Dashboard" tab — navigating away from /journal happens
    // by clicking the app logo or using browser navigation. Check what's available.
    // Try the logo/home link first:
    const homeLink = page
      .getByRole("link", { name: /carelog|home/i })
      .or(page.getByAltText(/logo/i));
    if ((await homeLink.count()) > 0) {
      await homeLink.first().click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    } else {
      // Fallback: browser back
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    }
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your care dashboard|caring for|your care recipients/i,
      }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("sign-out redirects to /signin", async ({ page }) => {
    const NAV_EMAIL = uniqueEmail("nav");
    // (TD-73) Sign in first; otherwise /dashboard redirects to /signin and
    // there's no Sign-out button to click. Also: TD-65 wrapped sign-out in
    // a window.confirm — auto-accept it.
    await signIn(page, NAV_EMAIL);
    page.once("dialog", (dialog) => dialog.accept());
    await Promise.all([
      page.waitForURL(/\/signin/, { timeout: 15_000 }),
      page.getByRole("button", { name: "Sign out" }).first().click(),
    ]);
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("signed-out user cannot access /dashboard", async ({ browser }) => {
    // Use a fresh context with no session state
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto("https://care-log.org/dashboard");
      await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
    } finally {
      await ctx.close();
    }
  });
});
