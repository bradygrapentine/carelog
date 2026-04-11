import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const TEST_EMAIL = "e2e-flag-reactions@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

async function writeEntry(page: any, text: string) {
  const textarea = page.getByPlaceholder("Share how today went...");
  await textarea.click();
  await textarea.fill(text);
  await page.waitForSelector("text=Share update", { timeout: 3000 });
  await page.click("text=Share update");
  await expect(textarea).toHaveValue("", { timeout: 12000 });
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

test("can flag an entry for doctor", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Flag test entry " + Date.now();
  await writeEntry(page, entryText);

  // The entry card should show a "Flag for doctor" button
  const entryCard = page.locator('[data-testid="journal-entry"]', {
    hasText: entryText,
  });
  const flagButton = entryCard.getByText("Flag for doctor");
  await expect(flagButton).toBeVisible();

  // Click flag — badge should appear with "Flagged for doctor" text
  await flagButton.click();
  await expect(entryCard.getByText("Flagged for doctor")).toBeVisible({
    timeout: 3000,
  });
});

test("can add a heart reaction to an entry", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Reaction test entry " + Date.now();
  await writeEntry(page, entryText);

  // Wait for reactions to load (fetched after render)
  await page.waitForTimeout(1000);

  const entryCard = page.locator('[data-testid="journal-entry"]', {
    hasText: entryText,
  });

  // Click the heart reaction
  const heartButton = entryCard.getByTitle("Heart");
  await expect(heartButton).toBeVisible();
  await heartButton.click();

  // Count should show 1, indicating pressed state
  await expect(heartButton.getByText("1")).toBeVisible({ timeout: 3000 });
});
