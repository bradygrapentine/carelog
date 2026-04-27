import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  uniqueEmail,
} from "./helpers";

// Coordinator account — must already exist (created by journal.spec.ts setup)

// Unique email per run — avoids "already pending" conflicts across test runs
function roleEmail(role: string) {
  return "e2e-" + role + "-" + Date.now() + "@test.com";
}

// Sets up coordinator + invitee with the given role, both on the journal page.
// Returns pages and BOTH contexts — callers must close them in finally blocks.
// (TD-73) Each call uses a fresh per-call coordinator email to dodge the
// Supabase per-email OTP cooldown.
async function setupRoleTest(browser: any, role: string, inviteeEmail: string) {
  const coordinatorCtx = await browser.newContext();
  const coordinatorPage = await coordinatorCtx.newPage();

  await signIn(coordinatorPage, uniqueEmail("roles-coord"));
  await navigateToJournal(coordinatorPage);
  const inviteUrl = await sendInviteAndGetUrl(
    coordinatorPage,
    inviteeEmail,
    role,
  );

  const { page: inviteePage, ctx: inviteeCtx } = await acceptInviteAsNewUser(
    browser,
    inviteUrl,
    inviteeEmail,
  );
  await navigateToJournal(inviteePage);

  return { coordinatorPage, coordinatorCtx, inviteePage, inviteeCtx };
}

test.beforeEach(async () => {
  await clearMailpit();
});

// ─── SUPPORTER ────────────────────────────────────────────────────────────────

test("supporter sees read-only message instead of entry form", async ({
  browser,
}) => {
  const email = roleEmail("supporter");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "supporter",
    email,
  );
  try {
    await expect(
      inviteePage.getByText("You're here as a Supporter"),
    ).toBeVisible();
    await expect(
      inviteePage.getByPlaceholder("Share how today went..."),
    ).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("supporter does not see Invite someone button", async ({ browser }) => {
  const email = roleEmail("supporter");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "supporter",
    email,
  );
  try {
    await expect(inviteePage.getByText("Invite someone")).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("supporter does not see flag button on journal entries", async ({
  browser,
}) => {
  const email = roleEmail("supporter");
  const { coordinatorPage, coordinatorCtx, inviteePage, inviteeCtx } =
    await setupRoleTest(browser, "supporter", email);
  try {
    const entryText = "Supporter flag test " + Date.now();
    const textarea = coordinatorPage.getByPlaceholder(
      "Share how today went...",
    );
    await textarea.fill(entryText);
    await coordinatorPage.waitForSelector("text=Share update", {
      timeout: 3000,
    });
    await coordinatorPage.click("text=Share update");
    await expect(textarea).toHaveValue("", { timeout: 12000 });

    await inviteePage.reload();
    await expect(inviteePage.getByText("Care team")).toBeVisible({
      timeout: 15000,
    });
    const entryCard = inviteePage.locator('[data-testid="journal-entry"]', {
      hasText: entryText,
    });
    await expect(entryCard).toBeVisible({ timeout: 5000 });
    await expect(entryCard.getByText("Flag for doctor")).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("supporter can react to a journal entry", async ({ browser }) => {
  const email = roleEmail("supporter");
  const { coordinatorPage, coordinatorCtx, inviteePage, inviteeCtx } =
    await setupRoleTest(browser, "supporter", email);
  try {
    const entryText = "Supporter reaction test " + Date.now();
    const textarea = coordinatorPage.getByPlaceholder(
      "Share how today went...",
    );
    await textarea.fill(entryText);
    await coordinatorPage.waitForSelector("text=Share update", {
      timeout: 3000,
    });
    await coordinatorPage.click("text=Share update");
    await expect(textarea).toHaveValue("", { timeout: 12000 });

    await inviteePage.reload();
    await expect(inviteePage.getByText("Care team")).toBeVisible({
      timeout: 15000,
    });
    const entryCard = inviteePage.locator('[data-testid="journal-entry"]', {
      hasText: entryText,
    });
    await expect(entryCard).toBeVisible({ timeout: 5000 });
    await inviteePage.waitForTimeout(1000); // reactions load after render

    const heartButton = entryCard.getByTitle("Heart");
    await expect(heartButton).toBeVisible();
    await heartButton.click();
    await expect(heartButton.getByText("1")).toBeVisible({ timeout: 3000 });
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

// ─── CAREGIVER ────────────────────────────────────────────────────────────────

test("caregiver sees the entry form", async ({ browser }) => {
  const email = roleEmail("caregiver");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "caregiver",
    email,
  );
  try {
    await expect(
      inviteePage.getByPlaceholder("Share how today went..."),
    ).toBeVisible();
    await expect(
      inviteePage.getByText("You're here as a Supporter"),
    ).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("caregiver can write a journal entry", async ({ browser }) => {
  const email = roleEmail("caregiver");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "caregiver",
    email,
  );
  try {
    const entryText = "Caregiver entry test " + Date.now();
    const textarea = inviteePage.getByPlaceholder("Share how today went...");
    await textarea.fill(entryText);
    await inviteePage.waitForSelector("text=Share update", { timeout: 3000 });
    await inviteePage.click("text=Share update");
    await expect(textarea).toHaveValue("", { timeout: 12000 });
    await expect(inviteePage.getByText(entryText)).toBeVisible({
      timeout: 5000,
    });
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("caregiver can flag an entry", async ({ browser }) => {
  const email = roleEmail("caregiver");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "caregiver",
    email,
  );
  try {
    const entryText = "Caregiver flag test " + Date.now();
    const textarea = inviteePage.getByPlaceholder("Share how today went...");
    await textarea.fill(entryText);
    await inviteePage.waitForSelector("text=Share update", { timeout: 3000 });
    await inviteePage.click("text=Share update");
    await expect(textarea).toHaveValue("", { timeout: 12000 });

    const entryCard = inviteePage.locator('[data-testid="journal-entry"]', {
      hasText: entryText,
    });
    const flagButton = entryCard.getByText("Flag for doctor");
    await expect(flagButton).toBeVisible();
    await flagButton.click();
    await expect(entryCard.getByText("Flagged for doctor")).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("caregiver does not see Invite someone button", async ({ browser }) => {
  const email = roleEmail("caregiver");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "caregiver",
    email,
  );
  try {
    await expect(inviteePage.getByText("Invite someone")).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

// ─── AIDE ─────────────────────────────────────────────────────────────────────

test("aide sees the entry form and can flag entries", async ({ browser }) => {
  const email = roleEmail("aide");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "aide",
    email,
  );
  try {
    await expect(
      inviteePage.getByPlaceholder("Share how today went..."),
    ).toBeVisible();
    await expect(
      inviteePage.getByText("You're here as a Supporter"),
    ).not.toBeVisible();

    const entryText = "Aide flag test " + Date.now();
    const textarea = inviteePage.getByPlaceholder("Share how today went...");
    await textarea.fill(entryText);
    await inviteePage.waitForSelector("text=Share update", { timeout: 3000 });
    await inviteePage.click("text=Share update");
    await expect(textarea).toHaveValue("", { timeout: 12000 });

    const entryCard = inviteePage.locator('[data-testid="journal-entry"]', {
      hasText: entryText,
    });
    const flagButton = entryCard.getByText("Flag for doctor");
    await expect(flagButton).toBeVisible();
    await flagButton.click();
    await expect(entryCard.getByText("Flagged for doctor")).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});

test("aide does not see Invite someone button", async ({ browser }) => {
  const email = roleEmail("aide");
  const { inviteePage, coordinatorCtx, inviteeCtx } = await setupRoleTest(
    browser,
    "aide",
    email,
  );
  try {
    await expect(inviteePage.getByText("Invite someone")).not.toBeVisible();
  } finally {
    await coordinatorCtx.close();
    await inviteeCtx.close();
  }
});
