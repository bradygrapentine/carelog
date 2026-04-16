import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const TEST_EMAIL = "e2e-comments@test.com";

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

async function openCommentThread(page: any, entryText: string) {
  const entryCard = page.locator('[data-testid="journal-entry"]', {
    hasText: entryText,
  });
  const toggle = entryCard.locator("button[aria-expanded]");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return entryCard;
}

test("comment toggle shows 'Add a comment' when there are no comments", async ({
  page,
}) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Comment toggle test " + Date.now();
  await writeEntry(page, entryText);

  const entryCard = page.locator('[data-testid="journal-entry"]', {
    hasText: entryText,
  });
  await expect(entryCard.getByText("Add a comment")).toBeVisible();
});

test("can expand comment thread and post a comment", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Post comment test " + Date.now();
  await writeEntry(page, entryText);

  const entryCard = await openCommentThread(page, entryText);

  // Composer should be visible
  const composer = entryCard.getByPlaceholder("Add a comment…");
  await expect(composer).toBeVisible();

  // Post a comment
  const commentText = "Great update!";
  await composer.fill(commentText);
  await entryCard.getByRole("button", { name: "Post" }).click();

  // Comment should appear and toggle should update count
  await expect(entryCard.getByText(commentText)).toBeVisible({ timeout: 5000 });
  await expect(entryCard.getByText("1 comment")).toBeVisible({ timeout: 3000 });
});

test("can edit own comment", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Edit comment test " + Date.now();
  await writeEntry(page, entryText);

  const entryCard = await openCommentThread(page, entryText);

  // Post a comment
  await entryCard.getByPlaceholder("Add a comment…").fill("Original text");
  await entryCard.getByRole("button", { name: "Post" }).click();
  await expect(entryCard.getByText("Original text")).toBeVisible({
    timeout: 5000,
  });

  // Click edit
  await entryCard.getByRole("button", { name: "Edit comment" }).click();
  const editArea = entryCard.getByLabel("Edit comment body");
  await expect(editArea).toBeVisible();

  // Change the text and save
  await editArea.clear();
  await editArea.fill("Edited text");
  await entryCard.getByRole("button", { name: "Save" }).click();

  await expect(entryCard.getByText("Edited text")).toBeVisible({
    timeout: 5000,
  });
  await expect(entryCard.getByText("· edited")).toBeVisible({ timeout: 3000 });
});

test("can delete own comment", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Delete comment test " + Date.now();
  await writeEntry(page, entryText);

  const entryCard = await openCommentThread(page, entryText);

  // Post a comment
  const commentText = "Comment to delete";
  await entryCard.getByPlaceholder("Add a comment…").fill(commentText);
  await entryCard.getByRole("button", { name: "Post" }).click();
  await expect(entryCard.getByText(commentText)).toBeVisible({ timeout: 5000 });

  // Delete — accept the confirm dialog
  page.once("dialog", (dialog) => dialog.accept());
  await entryCard.getByRole("button", { name: "Delete comment" }).click();

  await expect(entryCard.getByText(commentText)).not.toBeVisible({
    timeout: 5000,
  });
  // Toggle should revert to "Add a comment"
  await expect(entryCard.getByText("Add a comment")).toBeVisible({
    timeout: 3000,
  });
});

test("collapsing thread hides comments", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await navigateToJournal(page);

  const entryText = "Collapse test " + Date.now();
  await writeEntry(page, entryText);

  const entryCard = await openCommentThread(page, entryText);

  // Post a comment
  await entryCard.getByPlaceholder("Add a comment…").fill("Collapse me");
  await entryCard.getByRole("button", { name: "Post" }).click();
  await expect(entryCard.getByText("Collapse me")).toBeVisible({
    timeout: 5000,
  });

  // Collapse
  const toggle = entryCard.locator("button[aria-expanded]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(entryCard.getByText("Collapse me")).not.toBeVisible();
});
