// e2e/burnout.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  uniqueEmail,
} from "./helpers";

function roleEmail(role: string) {
  return "e2e-burn-" + role + "-" + Date.now() + "@test.com";
}

/** Navigate to the "More" panel which contains the burnout check-in form. */
async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "More" }).click();
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
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);
    await expect(page.getByText("Team wellbeing")).toBeVisible({
      timeout: 8000,
    });
  });

  test("suppression copy shown when fewer than 3 check-ins exist", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
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
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
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
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
    // 2 OTP roundtrips (coordinator + caregiver) + multi-context navigation
    // budget; CI's slow runner needs >60s. (TD-73)
    test.setTimeout(180_000);
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
        // Diagnostic: confirm caregiver landed on /dashboard after invite acceptance
        await expect(caregiverPage).toHaveURL(/\/dashboard/, { timeout: 5000 });

        // Diagnostic: confirm "View care journal" is visible (caregiver joined a team)
        await expect(
          caregiverPage
            .getByRole("link", { name: /Open care journal for/i })
            .first(),
        ).toBeVisible({
          timeout: 10000,
        });

        await goToMorePanel(caregiverPage);

        // Diagnostic: confirm the More tab is active and the check-in form loaded
        await expect(
          caregiverPage.getByRole("button", { name: "Save check-in" }),
        ).toBeVisible({ timeout: 5000 });

        await submitBurnoutCheckIn(caregiverPage);

        // TD-69 added BOTH a sonner toast AND an inline status paragraph
        // saying "Check-in saved." — naked getByText hits both and triggers
        // strict mode. Scope to the inline status (role=status); the toast
        // auto-dismisses, the inline copy persists for the assertion window.
        await expect(
          caregiverPage.getByRole("status").getByText("Check-in saved."),
        ).toBeVisible({ timeout: 8000 });
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
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
    // 2 OTP roundtrips + multi-context + double-submit budget. (TD-73)
    test.setTimeout(180_000);
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
        // Diagnostic: confirm caregiver landed on /dashboard after invite acceptance
        await expect(caregiverPage).toHaveURL(/\/dashboard/, { timeout: 5000 });

        // Diagnostic: confirm "View care journal" is visible (caregiver joined a team)
        await expect(
          caregiverPage
            .getByRole("link", { name: /Open care journal for/i })
            .first(),
        ).toBeVisible({
          timeout: 10000,
        });

        await goToMorePanel(caregiverPage);

        // Diagnostic: confirm the More tab is active and the check-in form loaded
        await expect(
          caregiverPage.getByRole("button", { name: "Save check-in" }),
        ).toBeVisible({ timeout: 5000 });

        await submitBurnoutCheckIn(caregiverPage);
        // TD-69 added BOTH a sonner toast AND an inline status paragraph
        // saying "Check-in saved." — naked getByText hits both and triggers
        // strict mode. Scope to the inline status (role=status); the toast
        // auto-dismisses, the inline copy persists for the assertion window.
        await expect(
          caregiverPage.getByRole("status").getByText("Check-in saved."),
        ).toBeVisible({ timeout: 8000 });

        // Navigate away and back to reset the saved state in the component,
        // then submit again — should upsert silently without an error message.
        await caregiverPage.getByRole("tab", { name: "Journal" }).click();
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
    const COORDINATOR_EMAIL = uniqueEmail("burnout-coord");
    // 2 OTP roundtrips + multi-context budget. (TD-73)
    test.setTimeout(180_000);
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
        // Diagnostic: confirm supporter landed on /dashboard after invite acceptance
        await expect(supporterPage).toHaveURL(/\/dashboard/, { timeout: 5000 });

        // Diagnostic: confirm "View care journal" is visible (supporter joined a team)
        await expect(
          supporterPage
            .getByRole("link", { name: /Open care journal for/i })
            .first(),
        ).toBeVisible({
          timeout: 10000,
        });

        // Navigate to journal and click More tab
        await supporterPage
          .getByRole("link", { name: /Open care journal for/i })
          .first()
          .click();
        await supporterPage.waitForURL(/\/journal\//, { timeout: 10000 });
        await supporterPage.getByRole("tab", { name: "More" }).click();

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
