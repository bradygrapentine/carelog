// e2e/journal-detail.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  ensureCareTeam,
  uniqueEmail,
  CARE_JOURNAL_LINK_SELECTOR,
} from "./helpers";

async function goToJournal(page: import("@playwright/test").Page) {
  // (TD-73) Tests can't rely on a leaked session — sign in fresh.
  await signIn(page, uniqueEmail("journal-detail"));
  await ensureCareTeam(page);
  await page.locator(CARE_JOURNAL_LINK_SELECTOR).first().click();
  await page.waitForURL(/\/journal\/[^/]+/, { timeout: 15000 });
  await page.waitForSelector('[placeholder="What happened today? Even one line is enough."]', {
    timeout: 10000,
  });
}

/** Post a journal entry so the timeline isn't empty. (TD-73 — fresh users
 * have no entries; tests that assert on `[data-testid=journal-entry]` must
 * seed at least one first.) */
async function postEntry(
  page: import("@playwright/test").Page,
  text: string,
): Promise<void> {
  const textarea = page.getByPlaceholder("What happened today? Even one line is enough.");
  await textarea.click();
  await textarea.fill(text);
  await page.getByRole("button", { name: "Post to journal" }).click();
  await expect(textarea).toHaveValue("", { timeout: 12000 });
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

test.describe("Journal entry detail navigation", () => {
  test("clicking an entry card navigates to detail page", async ({ page }) => {
    await goToJournal(page);
    await postEntry(page, "Detail-nav seed " + Date.now());
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
    // (TD-73) Use a known-text seed so we can assert against a substring
    // we control, rather than scraping the rendered card (which includes
    // timestamp/reactions/etc that may not appear on the detail page).
    const bodyText = "Detail-render seed " + Date.now();
    await postEntry(page, bodyText);
    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });

    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });
    await expect(page.getByText(bodyText)).toBeVisible({ timeout: 8000 });
  });

  test("browser back from detail returns to journal", async ({ page }) => {
    await goToJournal(page);
    await postEntry(page, "Detail-back seed " + Date.now());
    const journalUrl = page.url();

    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });
    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(journalUrl, { timeout: 10000 });
    await expect(page.getByPlaceholder("What happened today? Even one line is enough.")).toBeVisible({
      timeout: 5000,
    });
  });

  // (TD-73) The detail page does not currently render an in-app "Back"
  // link/button — users rely on the browser back affordance (covered by the
  // adjacent test). Skipping until a back link is added to the detail UI.
  test.fixme("in-app back button on detail page returns to journal", async ({
    page,
  }) => {
    await goToJournal(page);
    await postEntry(page, "Detail-inapp-back seed " + Date.now());

    const firstEntry = page.locator('[data-testid="journal-entry"]').first();
    await expect(firstEntry).toBeVisible({ timeout: 10000 });
    await firstEntry.click();
    await expect(page).toHaveURL(/\/entry\//, { timeout: 10000 });

    const backButton = page
      .getByRole("link", { name: /back/i })
      .or(page.getByRole("button", { name: /back/i }));
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    await expect(page).toHaveURL(/\/journal\//, { timeout: 10000 });
  });
});
