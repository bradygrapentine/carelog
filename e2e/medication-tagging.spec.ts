import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  uniqueEmail,
} from "./helpers";

test.beforeEach(async () => {
  await clearMailpit();
});

async function writeEntry(page: any, text: string) {
  const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
  await textarea.click();
  await textarea.fill(text);
  await page.waitForSelector("text=Post to journal", { timeout: 3000 });
  await page.click("text=Post to journal");
  await expect(textarea).toHaveValue("", { timeout: 12000 });
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

async function addMedication(page: any, drugName: string) {
  // Click "Medications" accordion/tab to open panel
  await page.getByRole("tab", { name: "Medications" }).click();
  // Click "+ Add medication" button
  await page.getByTestId("add-medication-btn").click();
  // (TD-73) Form inputs use data-testids — `name=` attrs were removed.
  // Both drug name AND dosage are required.
  await page.locator('[data-testid="medication-name-input"]').fill(drugName);
  await page
    .locator('[data-testid="medication-dosage-input"]')
    .fill("10mg daily");
  // Submit — the form's submit button is "Add medication" (matches the
  // header button), not "Save".
  await page
    .getByRole("button", { name: /^add medication$/i })
    .last()
    .click();
  await expect(page.getByText(drugName)).toBeVisible({ timeout: 5000 });
}

test.describe("Medication chip-filter", () => {
  test("chip bar appears when medications exist", async ({ page }) => {
    const TEST_EMAIL = uniqueEmail("e2e-med-tagging");
    await signIn(page, TEST_EMAIL);
    await navigateToJournal(page);

    const medName = "Metformin";
    await addMedication(page, medName);

    // Verify chip bar chip with text "Metformin" is visible
    const chip = page.getByRole("button", { name: medName });
    await expect(chip).toBeVisible({ timeout: 5000 });
  });

  test.fixme("clicking a medication chip filters journal entries", async ({
    page,
  }) => {
    const TEST_EMAIL = uniqueEmail("e2e-med-tagging");
    await signIn(page, TEST_EMAIL);
    await navigateToJournal(page);

    const medName = "Aspirin";
    await addMedication(page, medName);

    const entryText = "Aspirin 81mg taken " + Date.now();
    await writeEntry(page, entryText);

    // Click the medication chip to filter
    const medChip = page.getByRole("button", { name: medName });
    await medChip.click();

    // Verify only one entry is shown
    await expect(page.locator('[data-testid="journal-entry"]')).toHaveCount(1, {
      timeout: 5000,
    });
  });

  test.fixme("clicking All chip resets the filter", async ({ page }) => {
    const TEST_EMAIL = uniqueEmail("e2e-med-tagging");
    await signIn(page, TEST_EMAIL);
    await navigateToJournal(page);

    const medName = "Lisinopril";
    await addMedication(page, medName);

    // Write multiple entries
    const entry1 = "First entry " + Date.now();
    const entry2 = "Second entry " + (Date.now() + 1000);
    await writeEntry(page, entry1);
    await writeEntry(page, entry2);

    // Click medication chip to filter
    const medChip = page.getByRole("button", { name: medName });
    await medChip.click();

    // Now click "All" button to reset filter
    const allButton = page.getByRole("button", { name: "All" });
    await allButton.click();

    // Verify multiple entries are visible again
    await expect(page.locator('[data-testid="journal-entry"]')).not.toHaveCount(
      1,
      { timeout: 5000 },
    );
  });

  test("vault chip bar filters documents", async ({ page }) => {
    const TEST_EMAIL = uniqueEmail("e2e-med-tagging");
    await signIn(page, TEST_EMAIL);
    await navigateToJournal(page);

    const medName = "Warfarin";
    await addMedication(page, medName);

    // Verify that the medication chip bar appears in the vault section
    const vaultMedChip = page.getByRole("button", { name: medName });
    await expect(vaultMedChip).toBeVisible({ timeout: 8000 });
  });

  test.fixme("medication detail shows linked sections", async ({ page }) => {
    const TEST_EMAIL = uniqueEmail("e2e-med-tagging");
    await signIn(page, TEST_EMAIL);
    await navigateToJournal(page);

    const medName = "Lisinopril";
    await addMedication(page, medName);

    // Click the expand/chevron button for that medication (or the medication itself)
    const medButton = page.getByRole("button", { name: medName });
    await medButton.click();

    // Verify "Linked documents" and "Recent entries" headings are visible
    await expect(page.getByText("Linked documents")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Recent entries")).toBeVisible({
      timeout: 5000,
    });
  });
});
