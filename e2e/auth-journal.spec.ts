import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


test.beforeEach(async () => {
  await clearMailpit();
});

test("sign in and navigate to journal — entry form loads", async ({ page }) => {
  const TEST_EMAIL = uniqueEmail("e2e-auth-journal");
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);
  await expect(page.getByPlaceholder("What happened today? Even one line is enough.")).toBeVisible();
});

test("create a journal entry and verify it appears in timeline", async ({
  page,
}) => {
  const TEST_EMAIL = uniqueEmail("e2e-auth-journal");
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Auth journal test entry " + Date.now();
  const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
  await textarea.click();
  await textarea.fill(entryText);
  await page.waitForSelector("text=Post to journal", { timeout: 3000 });
  await page.click("text=Post to journal");

  // Wait for form reset (entry successfully posted)
  await expect(textarea).toHaveValue("", { timeout: 12000 });
  // Entry should appear in timeline
  await expect(page.getByText(entryText)).toBeVisible({ timeout: 5000 });
});

test("select mood tag before posting and verify entry shows mood badge", async ({
  page,
}) => {
  const TEST_EMAIL = uniqueEmail("e2e-auth-journal");
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Mood tag test " + Date.now();
  const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
  await textarea.click();
  await textarea.fill(entryText);

  // (TD-52) Earlier `button[class*="mood"]` selector matched nothing — mood
  // buttons in JournalEntryForm have classes like bg-green-100/text-green-800
  // (no "mood" substring). Stable data-mood attr added to the form. Same
  // story for selection state: there's no `data-selected` — switched to
  // standard aria-pressed which the component now sets.
  const moodButton = page.locator("button[data-mood=good]");
  await moodButton.click();
  await expect(moodButton).toHaveAttribute("aria-pressed", "true");

  await page.waitForSelector("text=Post to journal", { timeout: 3000 });
  await page.click("text=Post to journal");

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
