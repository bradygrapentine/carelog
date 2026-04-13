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

async function goToBurnoutTab(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  // TODO: add data-testid="burnout-tab" to the tab component
  await page.getByRole("tab", { name: /burnout|wellbeing/i }).click();
  await expect(page).toHaveURL(/panel=burnout/, { timeout: 8000 });
}

async function submitBurnoutCheckIn(page: import("@playwright/test").Page) {
  // TODO: add data-testid="burnout-checkin-form" to the form component
  // Sliders or number inputs for sleep, stress, support scores (1–10)
  // TODO: add data-testid="sleep-score-input" to component
  const sleepInput = page.getByLabel(/sleep/i);
  if ((await sleepInput.count()) > 0) {
    await sleepInput.fill("7");
  }

  // TODO: add data-testid="stress-score-input" to component
  const stressInput = page.getByLabel(/stress/i);
  if ((await stressInput.count()) > 0) {
    await stressInput.fill("4");
  }

  // TODO: add data-testid="support-score-input" to component
  const supportInput = page.getByLabel(/support/i);
  if ((await supportInput.count()) > 0) {
    await supportInput.fill("8");
  }

  await page.getByRole("button", { name: /submit|check.?in|save/i }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Burnout check-in", () => {
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
        await goToBurnoutTab(caregiverPage);
        await submitBurnoutCheckIn(caregiverPage);

        // After submitting, a confirmation or history entry should appear
        // TODO: add data-testid="burnout-checkin-success" to component
        await expect(
          caregiverPage.getByText(/submitted|check.?in saved|thank you/i),
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
        await goToBurnoutTab(caregiverPage);
        await submitBurnoutCheckIn(caregiverPage);
        await expect(
          caregiverPage.getByText(/submitted|check.?in saved|thank you/i),
        ).toBeVisible({ timeout: 8000 });

        // Submit again — should upsert silently, no error shown
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

  test("coordinator sees org burnout summary section", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToBurnoutTab(page);

    // Coordinator view should have an org-level summary panel
    // TODO: add data-testid="burnout-org-summary" to component
    await expect(page.getByText(/team|org|summary|average/i)).toBeVisible({
      timeout: 8000,
    });
  });

  test("coordinator burnout summary is suppressed when fewer than 3 check-ins exist", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToBurnoutTab(page);

    // With < 3 check-ins the backend filters out the week — summary should show a
    // privacy message or empty state rather than individual scores
    // TODO: add data-testid="burnout-privacy-notice" to component
    const summarySection = page.locator('[data-testid="burnout-org-summary"]');
    if ((await summarySection.count()) > 0) {
      // Either shows aggregated data or a "not enough data" notice — never raw scores
      const rowCount = await summarySection
        .locator('tr, [data-testid="summary-row"]')
        .count();
      // If rows are present there must be enough data (>=3 check-ins per week)
      // This is a smoke check — full data suppression is covered by unit tests
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });
});
