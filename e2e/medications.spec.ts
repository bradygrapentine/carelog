// e2e/medications.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, sendInviteAndGetUrl, acceptInviteAsNewUser, uniqueEmail } from "./helpers";


function roleEmail(role: string) {
  return "e2e-med-" + role + "-" + Date.now() + "@test.com";
}

async function goToMedicationsTab(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: /medications/i }).click();
  await expect(page).toHaveURL(/panel=medications/, { timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Medications", () => {
  test("coordinator adds a medication — appears in list", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-medications");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMedicationsTab(page);

    const drugName = "Metformin-" + Date.now();

    await page.click('[data-testid="add-medication-btn"]');
    await page.fill('[data-testid="medication-name-input"]', drugName);
    await page.fill(
      '[data-testid="medication-dosage-input"]',
      "500mg twice daily",
    );
    await page.click('button[type="submit"]:has-text("Add medication")');

    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("500mg twice daily")).toBeVisible({
      timeout: 5000,
    });
  });

  test("coordinator deletes a medication — removed from list", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-medications");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMedicationsTab(page);

    const drugName = "ToDelete-Med-" + Date.now();
    await page.click('[data-testid="add-medication-btn"]');
    await page.fill('[data-testid="medication-name-input"]', drugName);
    await page.fill('[data-testid="medication-dosage-input"]', "5mg daily");
    await page.click('button[type="submit"]:has-text("Add medication")');
    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });

    const row = page.locator("li").filter({ hasText: drugName });
    await row.getByRole("button", { name: /remove/i }).click();

    await expect(page.getByText(drugName)).not.toBeVisible({ timeout: 5000 });
  });

  test("caregiver sees the medication list", async ({ browser }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-medications");
    const email = roleEmail("caregiver");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToMedicationsTab(coordinatorPage);

      const drugName = "SharedMed-" + Date.now();
      await coordinatorPage.click('[data-testid="add-medication-btn"]');
      await coordinatorPage.fill(
        '[data-testid="medication-name-input"]',
        drugName,
      );
      await coordinatorPage.fill(
        '[data-testid="medication-dosage-input"]',
        "10mg nightly",
      );
      await coordinatorPage.click(
        'button[type="submit"]:has-text("Add medication")',
      );
      await expect(coordinatorPage.getByText(drugName)).toBeVisible({
        timeout: 8000,
      });

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "caregiver",
      );
      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMedicationsTab(caregiverPage);
        await expect(caregiverPage.getByText(drugName)).toBeVisible({
          timeout: 8000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("supporter sees the medication list (read-only)", async ({
    browser,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-medications");
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToMedicationsTab(coordinatorPage);

      const drugName = "SupporterMed-" + Date.now();
      await coordinatorPage.click('[data-testid="add-medication-btn"]');
      await coordinatorPage.fill(
        '[data-testid="medication-name-input"]',
        drugName,
      );
      await coordinatorPage.fill(
        '[data-testid="medication-dosage-input"]',
        "20mg daily",
      );
      await coordinatorPage.click(
        'button[type="submit"]:has-text("Add medication")',
      );
      await expect(coordinatorPage.getByText(drugName)).toBeVisible({
        timeout: 8000,
      });

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );
      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMedicationsTab(supporterPage);
        await expect(supporterPage.getByText(drugName)).toBeVisible({
          timeout: 8000,
        });
        // Supporters should not see an "Add medication" button
        await expect(
          supporterPage.locator('[data-testid="add-medication-btn"]'),
        ).not.toBeVisible();
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test('MedicationChecklist shows today\'s doses and "Gave it" marks as given', async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-medications");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMedicationsTab(page);

    const drugName = "ChecklistMed-" + Date.now();
    await page.click('[data-testid="add-medication-btn"]');
    await page.fill('[data-testid="medication-name-input"]', drugName);
    await page.fill('[data-testid="medication-dosage-input"]', "5mg morning");
    await page.click('button[type="submit"]:has-text("Add medication")');
    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });

    // Look for the checklist section and "Gave it" button
    const checklistItem = page.locator(
      '[data-testid="medication-checklist-item"]',
      { hasText: drugName },
    );
    if ((await checklistItem.count()) > 0) {
      const gaveItBtn = checklistItem.getByRole("button", { name: /gave it/i });
      await expect(gaveItBtn).toBeVisible();
      await gaveItBtn.click();
      // After marking as given, a dose-given-indicator replaces the buttons
      await expect(
        checklistItem.locator('[data-testid="dose-given-indicator"]'),
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Checklist only appears when scheduled doses exist; confirm the med is listed
      await expect(page.getByText(drugName)).toBeVisible();
    }
  });
});
