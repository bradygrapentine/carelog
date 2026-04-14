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

test.describe("Team member removal (TeamPanel)", () => {
  test("coordinator sees a Remove button for another member", async ({
    browser,
  }) => {
    const email = "e2e-teamrm-caregiver-" + Date.now() + "@test.com";
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await navigateToJournal(coordinatorPage);

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "caregiver",
      );
      const { ctx: caregiverCtx } = await acceptInviteAsNewUser(
        browser,
        inviteUrl,
        email,
      );
      await caregiverCtx.close();

      // Back to coordinator — go to Team panel and confirm Remove button exists
      await coordinatorPage.getByRole("button", { name: "Team" }).click();

      const removeBtn = coordinatorPage
        .getByRole("button", { name: /^Remove / })
        .first();
      await expect(removeBtn).toBeVisible({ timeout: 10000 });
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("coordinator cannot see a Remove button for themselves", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.getByRole("button", { name: "Team" }).click();

    // The coordinator row carries a "you" suffix; a Remove button on it would be a bug
    const youRow = page.locator('div:has-text("you")').first();
    await expect(youRow).toBeVisible({ timeout: 8000 });
    await expect(youRow.getByRole("button", { name: /^Remove / })).toHaveCount(
      0,
    );
  });
});
