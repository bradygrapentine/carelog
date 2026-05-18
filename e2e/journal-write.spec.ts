// e2e/journal-write.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Journal write flows", () => {
  test("create a journal entry — appears in timeline", async ({ page }) => {
    const AUTHOR_EMAIL = uniqueEmail("e2e-author");
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const uniqueText = "E2E test entry " + Date.now();
    const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
    await textarea.click();
    await textarea.fill(uniqueText);

    // Select a mood
    await page.click('button:has-text("Good")');
    await page.click('button:has-text("Post to journal")');

    // Entry appears in timeline
    await expect(
      page
        .locator('[data-testid="journal-entry"]')
        .filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("entry persists after page reload", async ({ page }) => {
    const AUTHOR_EMAIL = uniqueEmail("e2e-author");
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const uniqueText = "Persist test " + Date.now();
    const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
    await textarea.click();
    await textarea.fill(uniqueText);
    await page.click('button:has-text("Post to journal")');

    await expect(
      page
        .locator('[data-testid="journal-entry"]')
        .filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });

    await page.reload();

    await expect(
      page
        .locator('[data-testid="journal-entry"]')
        .filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("form clears after submit", async ({ page }) => {
    const AUTHOR_EMAIL = uniqueEmail("e2e-author");
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
    await textarea.click();
    await textarea.fill("Clearing test " + Date.now());
    await page.click('button:has-text("Post to journal")');

    // Form returns to empty state after submit
    await expect(textarea).toHaveValue("", { timeout: 8000 });
  });
});
