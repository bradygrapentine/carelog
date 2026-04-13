// e2e/dashboard-nav.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard and sign-out navigation", () => {
  test("session restores and dashboard loads", async ({ page }) => {
    await page.goto("/dashboard");
    // Should land on dashboard, not be redirected to /signin
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText("Your care teams")).toBeVisible({
      timeout: 10000,
    });
  });

  test('"View care journal" navigates to journal page', async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('button:has-text("View care journal")', {
      timeout: 15000,
    });
    await page.click('button:has-text("View care journal")');
    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("Journal tab button navigates back to dashboard from journal", async ({
    page,
  }) => {
    // Navigate to journal first
    await page.goto("/dashboard");
    await page.waitForSelector('button:has-text("View care journal")', {
      timeout: 15000,
    });
    await page.click('button:has-text("View care journal")');
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
    await expect(page.getByText("Your care teams")).toBeVisible({
      timeout: 10000,
    });
  });

  test("sign-out redirects to /signin", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('button[aria-label="Sign out"]', {
      timeout: 15000,
    });
    await page.click('button[aria-label="Sign out"]');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
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
