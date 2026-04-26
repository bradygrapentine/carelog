// e2e/journal-detail.spec.ts
import { test, expect } from "@playwright/test";

async function goToJournal(page: any) {
  await page.goto("/dashboard");
  await page.waitForSelector('text="View care journal"', {
    timeout: 15000,
  });
  await page.click('text="View care journal"');
  await page.waitForURL(/\/journal\/[^/]+/, { timeout: 15000 });
  await page.waitForSelector('[placeholder="Share how today went..."]', {
    timeout: 10000,
  });
}

test.describe("Journal entry detail navigation", () => {
  test("clicking an entry card navigates to detail page", async ({ page }) => {
    await goToJournal(page);
    // Wait for at least one entry to appear in the timeline
    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });

    const journalUrl = page.url();
    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });
    // URL must not still be the journal page
    expect(page.url()).not.toBe(journalUrl);
  });

  test("detail page renders entry content", async ({ page }) => {
    await goToJournal(page);
    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });
    // Capture the entry text before navigating
    const entryText = await firstEntry.textContent();

    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });
    // The entry text should appear on the detail page
    if (entryText && entryText.trim().length > 5) {
      await expect(page.getByText(entryText.trim().slice(0, 40))).toBeVisible({
        timeout: 8000,
      });
    }
  });

  test("browser back from detail returns to journal", async ({ page }) => {
    await goToJournal(page);
    const journalUrl = page.url();

    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });
    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(journalUrl, { timeout: 10000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 5000,
    });
  });

  test("in-app back button on detail page returns to journal", async ({
    page,
  }) => {
    await goToJournal(page);

    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });
    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });

    // In-app back — look for a back button or link
    const backButton = page
      .getByRole("link", { name: /back/i })
      .or(page.getByRole("button", { name: /back/i }));
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    await expect(page).toHaveURL(/\/journal\//, { timeout: 10000 });
  });
});
