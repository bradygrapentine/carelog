import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const COORDINATOR_EMAIL = "e2e-billing@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Billing page", () => {
  test("unauthenticated user redirected to /signin", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForURL("**/signin", { timeout: 15000 });
    await expect(page).toHaveURL(/\/signin/);
  });

  test("coordinator sees Billing heading", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/billing");
    await expect(
      page.getByRole("heading", { name: /billing/i, level: 1 }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("billing shows plan info", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/billing");
    await expect(
      page.getByRole("heading", { name: /billing/i, level: 1 }),
    ).toBeVisible({
      timeout: 15000,
    });
    // Accept either free or paid plan state — don't fail on plan state
    const planVisible = await page
      .getByText(/Free Plan|Family Plan/i)
      .isVisible()
      .catch(() => false);
    expect(planVisible).toBe(true);
  });
});
