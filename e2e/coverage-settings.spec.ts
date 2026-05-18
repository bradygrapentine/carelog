// e2e/coverage-settings.spec.ts  (ON-05)
// TD-72: CoverageSettings.tsx exists at
//   apps/web/app/(app)/journal/[recipientId]/CoverageSettings.tsx
// but is NOT wired into JournalLayout.tsx — the Shifts tab renders only
// ShiftForm + ShiftList.  All tests below are fixme'd until the component
// is re-integrated into the Shifts panel.
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser, uniqueEmail } from "./helpers";

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
      .or(page.getByText("No coverage windows set yet. Add one to mark when someone is on duty.")),
  ).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Coverage settings — coordinator", () => {
  test.fixme("coordinator can expand coverage settings accordion", // TD-72: CoverageSettings is not rendered in JournalLayout Shifts tab.
  // Re-enable once the component is wired in.
  async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("cov-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToCoverageSettings(page);

    // The "Add coverage window" form label should be visible.
    await expect(page.getByText("Add coverage window")).toBeVisible({
      timeout: 5000,
    });
  });

  test.fixme("coordinator can add a recurring coverage window", // TD-72: CoverageSettings is not rendered in JournalLayout Shifts tab.
  // Re-enable once the component is wired in.
  async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("cov-coord");
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
  test.fixme("supporter does not see CoverageSettings component", // TD-72: CoverageSettings is not rendered in JournalLayout Shifts tab;
  // the not.toBeVisible assertion passes trivially, but the test structure
  // (invite flow) is kept intact for when the component is re-integrated.
  async ({ browser }) => {
    const COORDINATOR_EMAIL = uniqueEmail("cov-coord");
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
