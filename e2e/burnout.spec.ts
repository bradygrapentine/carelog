// e2e/burnout.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-burnout@test.com";

function roleEmail(role: string) {
  return "e2e-burn-" + role + "-" + Date.now() + "@test.com";
}

/** Navigate to the "More" panel which contains the burnout check-in form. */
async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByText("How are you doing this week?")).toBeVisible({
    timeout: 8000,
  });
}

/**
 * Submit the burnout check-in form using default slider values (3/5).
 * The form always has valid defaults so we just click Save.
 */
async function submitBurnoutCheckIn(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Save check-in" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Burnout org summary privacy", () => {
  test("coordinator sees 'Team wellbeing' panel", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);
    await expect(page.getByText("Team wellbeing")).toBeVisible({
      timeout: 8000,
    });
  });

  test("suppression copy shown when fewer than 3 check-ins exist", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);
    // min-group suppression: body explains individual scores are never shown
    await expect(
      page.getByText(/Individual scores are never shown/),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Burnout check-in", () => {
  test("coordinator sees burnout check-in form on More panel", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(
      page.getByRole("button", { name: "Save check-in" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Sleep quality")).toBeVisible();
    await expect(page.getByLabel("Stress level")).toBeVisible();
    await expect(page.getByLabel("Support from others")).toBeVisible();
  });

  test("caregiver completes a burnout check-in", async ({ browser }) => {
    const email = roleEmail("caregiver");
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

      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMorePanel(caregiverPage);
        await submitBurnoutCheckIn(caregiverPage);

        await expect(caregiverPage.getByText("Check-in saved.")).toBeVisible({
          timeout: 8000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("weekly idempotency — submitting twice in same week does not error", async ({
    browser,
  }) => {
    const email = roleEmail("caregiver-idem");
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

      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMorePanel(caregiverPage);
        await submitBurnoutCheckIn(caregiverPage);
        await expect(caregiverPage.getByText("Check-in saved.")).toBeVisible({
          timeout: 8000,
        });

        // Navigate away and back to reset the saved state in the component,
        // then submit again — should upsert silently without an error message.
        await caregiverPage.getByRole("button", { name: "Journal" }).click();
        await goToMorePanel(caregiverPage);
        await submitBurnoutCheckIn(caregiverPage);
        await expect(caregiverPage.getByText(/error|failed/i)).not.toBeVisible({
          timeout: 3000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("supporter does not see the burnout check-in form", async ({
    browser,
  }) => {
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await navigateToJournal(coordinatorPage);
      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );

      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await supporterPage.getByRole("button", { name: "More" }).click();
        // Supporters see the More panel but not the burnout form
        await expect(
          supporterPage.getByText("How are you doing this week?"),
        ).not.toBeVisible({ timeout: 5000 });
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
