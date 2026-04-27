// e2e/medication-write.spec.ts
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

async function goToMedicationsPanel(
  page: import("@playwright/test").Page,
  email: string,
) {
  await signIn(page, email);
  await navigateToJournal(page);
  await page.getByRole("tab", { name: /medications/i }).click();
  await expect(page).toHaveURL(/panel=medications/, { timeout: 8000 });
}

test.describe("Medication write flows", () => {
  test("add a medication — appears in list", async ({ page }) => {
    await goToMedicationsPanel(page, uniqueEmail("medw-author"));

    const drugName = "Lisinopril-" + Date.now();

    await page.click('button:has-text("Add medication")');
    await page.fill('[placeholder="e.g. Lisinopril"]', drugName);
    await page.fill('[placeholder="e.g. 10mg once daily"]', "10mg daily");
    await page.click('button[type="submit"]:has-text("Add medication")');

    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });
  });

  test.fixme("delete a medication — removed from list", async ({ page }) => {
    await goToMedicationsPanel(page, uniqueEmail("medw-author"));

    const drugName = "ToDelete-" + Date.now();
    await page.click('button:has-text("Add medication")');
    await page.fill('[placeholder="e.g. Lisinopril"]', drugName);
    await page.fill('[placeholder="e.g. 10mg once daily"]', "5mg");
    await page.click('button[type="submit"]:has-text("Add medication")');
    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });

    // Delete it via the Remove button on the medication row
    const row = page.locator("li").filter({ hasText: drugName });
    await row.getByRole("button", { name: /remove/i }).click();

    await expect(page.getByText(drugName)).not.toBeVisible({ timeout: 10_000 });
  });
});
