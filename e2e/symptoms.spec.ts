// e2e/symptoms.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser, uniqueEmail } from "./helpers";

function roleEmail(role: string) {
  return "e2e-sym-" + role + "-" + Date.now() + "@test.com";
}

/**
 * Navigate to the "More" panel and expand the symptom readings section.
 * The panel is collapsed by default — click "Symptom readings" to expand.
 */
async function goToSymptomsPanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "More" }).click();
  // Expand the symptom readings accordion
  await page.getByRole("button", { name: "Symptom readings" }).click();
  await expect(page.getByLabel("Pain level")).toBeVisible({ timeout: 8000 });
}

/**
 * Log a symptom reading using the form that appears after clicking "+ Log reading".
 * Selects "Good" mood and submits with default pain level (5/10).
 */
async function logSymptomReading(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "+ Log reading" }).click();
  // Select mood via pill button (aria-pressed)
  await page.getByRole("button", { name: "Good" }).click();
  await page.getByRole("button", { name: "Save reading" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Symptoms", () => {
  test.fixme("coordinator sees symptom readings panel on More panel", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("symp-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.getByRole("tab", { name: "More" }).click();
    // Collapsed state shows the expand button
    await expect(
      page.getByRole("button", { name: "Symptom readings" }),
    ).toBeVisible({ timeout: 8000 });
  });

  test.fixme("coordinator logs a symptom reading — appears in list", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("symp-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToSymptomsPanel(page);
    await logSymptomReading(page);

    // After save the form closes; the reading list updates
    // Pain level 5/10 is shown as "5/10" in the list
    await expect(page.getByText("5/10")).toBeVisible({ timeout: 8000 });
  });

  test.fixme("caregiver logs a symptom reading", async ({ browser }) => {
    const COORDINATOR_EMAIL = uniqueEmail("symp-coord");
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
        await goToSymptomsPanel(caregiverPage);
        await logSymptomReading(caregiverPage);
        await expect(caregiverPage.getByText("5/10")).toBeVisible({
          timeout: 8000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test.fixme("supporter sees symptom panel but not the log button", async ({
    browser,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("symp-coord");
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
        await supporterPage.getByRole("tab", { name: "More" }).click();
        // Expand the panel
        await supporterPage
          .getByRole("button", { name: "Symptom readings" })
          .click();

        // Supporters should not see the log reading button
        await expect(
          supporterPage.getByRole("button", { name: "+ Log reading" }),
        ).not.toBeVisible({ timeout: 5000 });
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
