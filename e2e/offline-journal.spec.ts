import { test, expect } from "@playwright/test";

test("journal entry queues offline and syncs on reconnect", async ({
  page,
  context,
}) => {
  // TODO: requires auth fixtures — skeleton for structure
  test.skip(true, "TODO: requires auth fixtures — skeleton for structure");

  // 1. Navigate to app (assumes active session)
  await page.goto("/");

  // 2. Go offline
  await context.setOffline(true);

  // 3. Navigate to a journal page — needs a known recipientId from fixtures
  // await page.goto('/journal/<recipientId>');

  // 4. Submit a journal entry
  // await page.getByPlaceholder("What happened today?").fill("Offline test entry");
  // await page.getByRole("button", { name: "Post" }).click();

  // 5. Expect "Saved locally" toast
  // await expect(page.getByText("Saved locally")).toBeVisible();

  // 6. Go back online
  await context.setOffline(false);

  // 7. Wait for auto-sync (reconnect triggers flushQueue)
  // await page.waitForTimeout(2000);

  // 8. Expect "Synced" toast
  // await expect(page.getByText(/Synced \d+ queued/)).toBeVisible();

  expect(true).toBe(true);
});
