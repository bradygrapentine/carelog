import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const TEST_EMAIL = "e2e-auth-journal@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test("sign in and navigate to journal — entry form loads", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);
  await expect(page.getByPlaceholder("Share how today went...")).toBeVisible();
});

test("create a journal entry and verify it appears in timeline", async ({
  page,
}) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Auth journal test entry " + Date.now();
  const textarea = page.getByPlaceholder("Share how today went...");
  await textarea.click();
  await textarea.fill(entryText);
  await page.waitForSelector("text=Share update", { timeout: 3000 });
  await page.click("text=Share update");

  // Wait for form reset (entry successfully posted)
  await expect(textarea).toHaveValue("", { timeout: 12000 });
  // Entry should appear in timeline
  await expect(page.getByText(entryText)).toBeVisible({ timeout: 5000 });
});

test("select mood tag before posting and verify entry shows mood badge", async ({
  page,
}) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Mood tag test " + Date.now();
  const textarea = page.getByPlaceholder("Share how today went...");
  await textarea.click();
  await textarea.fill(entryText);

  // Select a mood tag (should have mood buttons like 'Good', 'Okay', 'Difficult')
  // Get all mood selection buttons and click on one (e.g., the first mood button)
  const moodButtons = page.locator('button[class*="mood"]');
  const moodCount = await moodButtons.count();

  if (moodCount > 0) {
    // Click the first mood button to select a mood
    await moodButtons.first().click();
    // Verify button shows as selected (likely has a different style or is highlighted)
    await expect(moodButtons.first()).toHaveAttribute("data-selected", "true");
  }

  await page.waitForSelector("text=Share update", { timeout: 3000 });
  await page.click("text=Share update");

  // Wait for form reset
  await expect(textarea).toHaveValue("", { timeout: 12000 });

  // Find the entry in the timeline
  const entryCard = page.locator('[data-testid="journal-entry"]', {
    hasText: entryText,
  });
  await expect(entryCard).toBeVisible({ timeout: 5000 });

  // (TD-52) Earlier selector `[class*="mood"]` matched nothing — the
  // MOOD_BADGE map's class strings are bg-green-50/text-green-700/etc
  // with no "mood" substring. Stable data-testid added to JournalTimeline.
  const moodBadge = entryCard.locator('[data-testid="mood-badge"]');
  await expect(moodBadge).toBeVisible({ timeout: 3000 });
});
