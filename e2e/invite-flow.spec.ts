import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  CARE_JOURNAL_LINK_SELECTOR,
} from "./helpers";

// Per-test coordinator email — same reasoning as invitee emails: a fresh
// coordinator each test side-steps any per-email Supabase rate-limit and
// avoids cross-test session leakage. (TD-73)
function coordinatorEmail(suffix: string): string {
  return `e2e-coord-flow-${suffix}-${Date.now()}@test.com`;
}
// Invitee emails are timestamped per-test so a partially-completed previous
// run (which leaves a pending invite_token in the DB) doesn't 409 the next
// run with "An invite for this email is already pending". (TD-73)
function inviteeEmail(suffix: string): string {
  return `e2e-invitee-flow-${suffix}-${Date.now()}@test.com`;
}

test.beforeEach(async () => {
  await clearMailpit();
});

test("invitee accepts invite and sees care team dashboard", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = inviteeEmail("accept");
  const coordEmail = coordinatorEmail("accept");
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Coordinator sets up and sends invite
    await signIn(coordinatorPage, coordEmail);
    await navigateToJournal(coordinatorPage);

    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      email,
      "caregiver",
    );
    expect(inviteUrl).toMatch(/\/invite\//);

    // Invitee accepts invite as new user
    const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      email,
    );

    try {
      // acceptInviteAsNewUser already waits for /dashboard. The
      // "You have joined the team" success page is on /invite/[token]
      // and auto-redirects to /dashboard after 2s, so we can't catch it
      // here — assert on the dashboard state instead.
      await expect(inviteePage.getByText("Your care teams")).toBeVisible({
        timeout: 10000,
      });
      // Verify the joined team is visible on the dashboard (not just the
      // empty state). Either the journal-link card OR the "Set up a care
      // team" CTA satisfies "user has reached a usable dashboard."
      await expect(
        inviteePage
          .locator(
            `${CARE_JOURNAL_LINK_SELECTOR}, a:has-text("Set up a care team")`,
          )
          .first(),
      ).toBeVisible({ timeout: 8000 });
    } finally {
      await inviteeCtx.close();
    }
  } finally {
    await coordinatorCtx.close();
  }
});

test("coordinator sees new team member after invitation acceptance", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = inviteeEmail("seemember");
  const coordEmail = coordinatorEmail("seemember");
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Coordinator sets up and sends invite
    await signIn(coordinatorPage, coordEmail);
    await navigateToJournal(coordinatorPage);

    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      email,
      "supporter",
    );

    // Invitee accepts invite
    const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      email,
    );
    await inviteeCtx.close();

    // Coordinator reloads and verifies team panel shows new member.
    // Re-navigate to the Team panel since reload() restores ?panel=journal.
    await coordinatorPage.reload();
    await coordinatorPage.getByRole("tab", { name: "Team" }).first().click();
    // The string "Care team" appears in BOTH the CardTitle and the helper
    // copy "...join this care team" — scope to the heading.
    await expect(
      coordinatorPage.locator('[data-slot="card-title"]', {
        hasText: "Care team",
      }),
    ).toBeVisible({ timeout: 15000 });
    // Fresh coordinator + 1 accepted invitee = exactly 2 members.
    await expect(coordinatorPage.getByText(/2 members/)).toBeVisible({
      timeout: 5000,
    });
  } finally {
    await coordinatorCtx.close();
  }
});
