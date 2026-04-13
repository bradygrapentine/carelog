// e2e/symptoms.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-symptoms@test.com";

function roleEmail(role: string) {
  return "e2e-sym-" + role + "-" + Date.now() + "@test.com";
}

async function goToSymptomsTab(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  // TODO: add data-testid="symptoms-tab" to the tab component
  await page.getByRole("tab", { name: /symptoms/i }).click();
  await expect(page).toHaveURL(/panel=symptoms/, { timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Symptoms", () => {
  test("coordinator logs a symptom reading — appears in list", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToSymptomsTab(page);

    // TODO: add data-testid="log-symptom-btn" to component
    await page
      .getByRole("button", { name: /log symptom|add reading/i })
      .click();

    // TODO: add data-testid="symptom-type-select" to component
    await page
      .getByRole("combobox", { name: /symptom|type/i })
      .selectOption({ index: 1 });

    // TODO: add data-testid="symptom-value-input" to component
    const valueInput = page.getByRole("spinbutton").first();
    await valueInput.fill("7");

    // TODO: add data-testid="symptom-notes-input" to component
    const notesInput = page.getByPlaceholder(/notes|observation/i);
    if ((await notesInput.count()) > 0) {
      await notesInput.fill("E2E test reading");
    }

    await page.getByRole("button", { name: /save|log|submit/i }).click();

    // TODO: add data-testid="symptom-reading-row" to component
    await expect(page.getByText("7")).toBeVisible({ timeout: 8000 });
  });

  test("caregiver logs a symptom reading", async ({ browser }) => {
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
        await goToSymptomsTab(caregiverPage);

        await caregiverPage
          .getByRole("button", { name: /log symptom|add reading/i })
          .click();
        await caregiverPage
          .getByRole("combobox", { name: /symptom|type/i })
          .selectOption({ index: 1 });

        const valueInput = caregiverPage.getByRole("spinbutton").first();
        await valueInput.fill("5");
        await caregiverPage
          .getByRole("button", { name: /save|log|submit/i })
          .click();

        await expect(caregiverPage.getByText("5")).toBeVisible({
          timeout: 8000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("supporter sees symptom readings (read-only, no log button)", async ({
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
        await goToSymptomsTab(supporterPage);

        // Supporters should not be able to log symptoms
        await expect(
          supporterPage.getByRole("button", {
            name: /log symptom|add reading/i,
          }),
        ).not.toBeVisible();

        // But the symptom list/panel should still render
        // TODO: add data-testid="symptoms-panel" to component
        await expect(
          supporterPage.getByRole("tab", { name: /symptoms/i }),
        ).toBeVisible();
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
