import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Subscriptions page", () => {
  test("unauthenticated user redirected to /signin", async ({ page }) => {
    await page.goto("/subscriptions");
    await page.waitForURL("**/signin", { timeout: 15000 });
    expect(page.url()).toContain("/signin");
  });

  test("shows Subscription heading", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-subscriptions");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/subscriptions");
    await expect(page.locator("h1")).toHaveText("Subscription", {
      timeout: 15000,
    });
  });

  test("shows Family Plan with $14 price", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-subscriptions");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/subscriptions");
    await expect(page.getByText("Family Plan")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("$14")).toBeVisible({ timeout: 10000 });
  });

  test("shows no billing history message", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-subscriptions");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/subscriptions");
    await expect(page.getByText("No charges yet. Receipts will show up here once your plan starts.")).toBeVisible({
      timeout: 10000,
    });
  });
});
