import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-team-admin@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Team Admin", () => {
  test("unauthenticated user redirected to /signin", async ({ page }) => {
    await page.goto("/team/admin");
    await page.waitForURL("**/signin", { timeout: 15000 });
    await expect(page).toHaveURL(/\/signin/);
  });

  test("coordinator sees Team Admin heading", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/team/admin");
    await expect(
      page.getByRole("heading", { name: /team admin/i, level: 1 }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("coordinator sees members table", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.goto("/team/admin");
    await expect(
      page.getByRole("heading", { name: /team admin/i, level: 1 }),
    ).toBeVisible({
      timeout: 15000,
    });
    // Wait for loading state to resolve
    await page
      .waitForFunction(() => !document.body.innerText.includes("Loading"), {
        timeout: 12000,
      })
      .catch(() => {
        // Loading text may not appear at all — continue
      });
    // Member column header should be visible once data loads
    await expect(
      page.getByRole("columnheader", { name: /member/i }),
    ).toBeVisible({
      timeout: 12000,
    });
    await expect(page.getByRole("columnheader", { name: /role/i })).toBeVisible(
      {
        timeout: 12000,
      },
    );
  });
});
