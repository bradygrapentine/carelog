import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  uniqueEmail,
} from "./helpers";

test.beforeEach(async () => {
  await clearMailpit();
});

test("coordinator can invite a new user who accepts after signing in", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const COORDINATOR_EMAIL = uniqueEmail("inv-coord");
  const INVITEE_EMAIL = uniqueEmail("inv-invitee");
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Step 1: Coordinator signs in and navigates to the journal, then to
    // the Team panel where the invite form lives. (TD-73 — panels are
    // lazy-rendered off ?panel=).
    await signIn(coordinatorPage, COORDINATOR_EMAIL);
    await navigateToJournal(coordinatorPage);
    await coordinatorPage.getByRole("tab", { name: "Team" }).first().click();
    await expect(coordinatorPage.getByLabel("Email address")).toBeVisible();

    // Step 2: Send the invite and capture the URL
    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      INVITEE_EMAIL,
      "caregiver",
    );
    expect(inviteUrl).toMatch(/\/invite\//);

    // (TD-73) Steps 3–6 — replaced the in-test OTP flow with the canonical
    // `acceptInviteAsNewUser` helper which handles signin → invite-bridge
    // → accept correctly with hardened selectors. Re-using the helper
    // avoids the `text=Sign in` / `text=Accept invitation` ambiguities
    // that this older flow was tripping over after the TD-39/65 selector
    // hardening.
    const accepted = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      INVITEE_EMAIL,
    );
    await accepted.ctx.close();

    // Step 7: Coordinator's team panel should now show 2 members. Reload
    // resets ?panel=, so navigate back to Team. (TD-73)
    await coordinatorPage.reload();
    await coordinatorPage.getByRole("tab", { name: "Team" }).first().click();
    await expect(
      coordinatorPage.locator('[data-slot="card-title"]', {
        hasText: "Care team",
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(coordinatorPage.getByText(/2 members/)).toBeVisible({
      timeout: 5000,
    });
  } finally {
    await coordinatorCtx.close();
  }
});

test("invite page shows error for expired or invalid token", async ({
  page,
}) => {
  await page.goto("/invite/invalid-token-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Invite not found" }),
  ).toBeVisible({ timeout: 8000 });
});

test("invite page shows wrong-email error when signed in as different user", async ({
  page,
}) => {
  const COORDINATOR_EMAIL = uniqueEmail("inv-coord-wrong");
  await signIn(page, COORDINATOR_EMAIL);
  await navigateToJournal(page);

  // Renamed local from `uniqueEmail` to `inviteEmail` — the import shadowed.
  const inviteEmail = "wrong-email-" + Date.now() + "@test.com";
  const inviteUrl = await sendInviteAndGetUrl(page, inviteEmail, "supporter");

  await page.goto(inviteUrl);
  await page.click("text=Accept invitation");
  await expect(page.getByText("You are signed in as")).toBeVisible({
    timeout: 5000,
  });
});
