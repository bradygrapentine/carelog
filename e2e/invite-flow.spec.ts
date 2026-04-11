import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-coordinator-flow@test.com";
const INVITEE_EMAIL = "e2e-invitee-flow@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test("invitee accepts invite and sees care team dashboard", async ({
  browser,
}) => {
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Coordinator sets up and sends invite
    await signIn(coordinatorPage, COORDINATOR_EMAIL);
    await navigateToJournal(coordinatorPage);

    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      INVITEE_EMAIL,
      "caregiver",
    );
    expect(inviteUrl).toMatch(/\/invite\//);

    // Invitee accepts invite as new user
    const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      INVITEE_EMAIL,
    );

    try {
      // Verify invitee landed on dashboard with care team
      await expect(inviteePage.getByText("Your care teams")).toBeVisible({
        timeout: 10000,
      });
      await expect(
        inviteePage.getByText("You have joined the team"),
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
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  try {
    // Coordinator sets up and sends invite
    await signIn(coordinatorPage, COORDINATOR_EMAIL);
    await navigateToJournal(coordinatorPage);

    const inviteUrl = await sendInviteAndGetUrl(
      coordinatorPage,
      INVITEE_EMAIL,
      "supporter",
    );

    // Invitee accepts invite
    const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
      browser,
      inviteUrl,
      INVITEE_EMAIL,
    );
    await inviteeCtx.close();

    // Coordinator reloads and verifies team panel shows new member
    await coordinatorPage.reload();
    await expect(coordinatorPage.getByText("Care team")).toBeVisible({
      timeout: 15000,
    });
    await expect(coordinatorPage.getByText("2 members")).toBeVisible({
      timeout: 5000,
    });
  } finally {
    await coordinatorCtx.close();
  }
});
