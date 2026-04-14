import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

// Use distinct emails from invite-flow.spec.ts to avoid conflicts
const COORDINATOR_EMAIL = "e2e-coordinator-accept@test.com";
const INVITEE_EMAIL = "e2e-invitee-accept@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test("coordinator invite accepted — invitee lands on dashboard with correct role", async ({
  browser,
}) => {
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Coordinator signs in, navigates to journal, sends invite with explicit role
    await signIn(coordinatorPage, COORDINATOR_EMAIL);
    await navigateToJournal(coordinatorPage);

    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      INVITEE_EMAIL,
      "caregiver",
    );
    expect(inviteUrl).toMatch(/\/invite\//);

    // Invitee accepts invite in a fresh browser context (no existing session)
    const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      INVITEE_EMAIL,
    );

    try {
      // Invitee must land on the dashboard
      await expect(inviteePage).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // Dashboard shows care team section
      await expect(inviteePage.getByText("Your care teams")).toBeVisible({
        timeout: 10000,
      });

      // Role is displayed in the team panel (caregiver role label)
      await expect(inviteePage.getByText(/caregiver/i)).toBeVisible({
        timeout: 8000,
      });
    } finally {
      await inviteeCtx.close();
    }
  } finally {
    await coordinatorCtx.close();
  }
});

test("expired invite token shows error message", async ({ page }) => {
  // Navigate to an invalid / expired invite token directly
  await page.goto("/invite/invalid-token-that-does-not-exist");

  // The app should render an error state — not redirect silently
  // Accept any of the common error text patterns the UI may use
  const errorLocator = page.locator(
    [
      "text=/invalid/i",
      "text=/expired/i",
      "text=/not found/i",
      "text=/no longer valid/i",
      "text=/error/i",
    ].join(", "),
  );

  await expect(errorLocator.first()).toBeVisible({ timeout: 10000 });

  // Must NOT redirect to the dashboard (invitee has no valid session or team)
  await expect(page).not.toHaveURL(/\/dashboard/);
});
