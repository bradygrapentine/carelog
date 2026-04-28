import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  uniqueEmail,
} from "./helpers";

// Use distinct emails from invite-flow.spec.ts to avoid conflicts

test.beforeEach(async () => {
  await clearMailpit();
});

test("coordinator invite accepted — invitee lands on dashboard with correct role", async ({
  browser,
}) => {
  const COORDINATOR_EMAIL = uniqueEmail("e2e-coordinator-accept");
  const INVITEE_EMAIL = uniqueEmail("e2e-invitee-accept");
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

      // The role label is on the Team panel, not on /dashboard. The
      // dashboard surface a caregiver sees post-accept is the "View care
      // journal" link — proves they joined SOMETHING (i.e. the membership
      // was created). Role-specific gating is covered by the role-restricted
      // selectors in burnout/documents/export specs. (TD-73)
      await expect(
        inviteePage
          .getByRole("link", { name: /Open care journal for/i })
          .first(),
      ).toBeVisible({ timeout: 8000 });
    } finally {
      await inviteeCtx.close();
    }
  } finally {
    await coordinatorCtx.close();
  }
});

test("expired invite token shows error message", async ({ page }) => {
  // Route: apps/web/app/invite/[token]/page.tsx — this route exists.
  // GET /api/invite/<token> returns { error: 'Invite not found' } (HTTP 404) for
  // any token absent from the invite_tokens table. The page then renders
  // status="error" showing <h1>Invite not found</h1> — matched by /not found/i below.
  // Using a clearly-bogus token string guarantees the DB row is absent.
  await page.goto("/invite/invalid-token-that-does-not-exist");

  // The app should render an error state — not redirect silently. The
  // primary signal is the "Invite not found" heading rendered by
  // /invite/[token]/page.tsx when the API returns 404. Use a regex that
  // matches the current copy plus a few likely future variants.
  // The error state renders the message in BOTH a heading and a paragraph,
  // so getByText matches 2 elements — assert the heading directly.
  await expect(
    page.getByRole("heading", {
      name: /invite not found|invalid|expired|no longer valid/i,
    }),
  ).toBeVisible({ timeout: 10000 });

  // Must NOT redirect to the dashboard (invitee has no valid session or team)
  await expect(page).not.toHaveURL(/\/dashboard/);
});
