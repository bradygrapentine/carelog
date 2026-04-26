// e2e/coverage-settings.spec.ts  (ON-05)
// Covers CoverageSettings.tsx — the "Coverage expectations" accordion inside the
// Shifts panel (coordinator-only form; toggled via an expand/collapse button).
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-coverage@test.com";

function roleEmail(role: string) {
  return "e2e-cov-" + role + "-" + Date.now() + "@test.com";
}

/**
 * Navigate to the Shifts panel and expand the CoverageSettings accordion.
 * The component renders a button whose text toggles between "Expand" and "Collapse".
 */
async function goToCoverageSettings(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "Shifts" }).click();
  // Wait for the Shifts panel to finish loading.
  await expect(page.getByText("Shifts").first()).toBeVisible({ timeout: 8000 });
  // Expand the CoverageSettings accordion — the heading text is "Coverage expectations".
  await page.getByText("Coverage expectations").click();
  // After expanding, the "Add window" submit button (or empty-state text) should appear.
  await expect(
    page
      .getByRole("button", { name: "Add window" })
      .or(page.getByText("No coverage windows defined yet.")),
  ).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Coverage settings — coordinator", () => {
  test("coordinator can expand coverage settings accordion", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToCoverageSettings(page);

    // The "Add coverage window" form label should be visible.
    await expect(page.getByText("Add coverage window")).toBeVisible({
      timeout: 5000,
    });
  });

  test("coordinator can add a recurring coverage window", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToCoverageSettings(page);

    const label = "E2E Morning Coverage " + Date.now();

    // Fill the label input (placeholder: "Label (e.g. Weekday morning)").
    await page.fill('[placeholder="Label (e.g. Weekday morning)"]', label);

    // Start/end times have defaults (07:00 / 12:00) so no change needed.
    await page.getByRole("button", { name: "Add window" }).click();

    // After successful create the label field clears and the new window appears.
    await expect(page.getByText(label)).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Coverage settings — role gate", () => {
  test("supporter does not see CoverageSettings component", async ({
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
        await navigateToJournal(supporterPage);
        await supporterPage.getByRole("tab", { name: "Shifts" }).click();
        await expect(supporterPage.getByText("Shifts").first()).toBeVisible({
          timeout: 8000,
        });

        // CoverageSettings is not rendered for non-coordinators.
        await expect(
          supporterPage.getByText("Coverage expectations"),
        ).not.toBeVisible({ timeout: 3000 });
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
