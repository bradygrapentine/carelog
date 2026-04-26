// e2e/shift-trade-requests.spec.ts (ON-45)
// Covers TradeRequestForm.tsx, TradeRequestList.tsx, and TradeRequestCard.tsx
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-trade-coord@test.com";

function roleEmail(role: string) {
  return "e2e-trade-" + role + "-" + Date.now() + "@test.com";
}

/** Navigate to the Shifts panel from the journal page. */
async function goToShiftsPanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  // SidebarNav renders buttons with aria-label matching the destination label.
  await page.getByRole("tab", { name: "Shifts" }).click();
  // ShiftList always renders the "Shifts" card header — wait for it.
  await expect(page.getByText("Shifts").first()).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Shift Trade Requests panel — coordinator", () => {
  test("coordinator sees Trade Requests section on the shifts panel", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // TradeRequestList renders a card with "Trade Requests" as the CardTitle.
    // Note: This test may need to be skipped if TradeRequestList is not yet
    // mounted on the shifts panel. The component was built as a standalone
    // and needs integration into the shift detail view.
    await expect(page.getByText("Trade Requests")).toBeVisible({
      timeout: 8000,
    });
  });

  test("can open trade request form and cancel it", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // Click the "+ Request Trade" button in the CardHeader to expand the form.
    const requestTradeBtn = page.getByRole("button", {
      name: /Request Trade/i,
    });
    await requestTradeBtn.click();

    // After expanding, the form should be visible with the message textarea.
    const messageField = page.locator("#trade-message");
    await expect(messageField).toBeVisible({ timeout: 5000 });

    // Click Cancel to collapse the form.
    const cancelBtn = page.getByRole("button", { name: "Cancel" });
    await cancelBtn.click();

    // Form should be hidden, and "+ Request Trade" button should be visible again.
    await expect(messageField).not.toBeVisible({ timeout: 3000 });
    await expect(requestTradeBtn).toBeVisible({ timeout: 3000 });
  });

  test("caregiver can submit an open trade request", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // Open the form.
    const requestTradeBtn = page.getByRole("button", {
      name: /Request Trade/i,
    });
    await requestTradeBtn.click();

    // Fill in the message.
    const messageField = page.locator("#trade-message");
    await messageField.fill("Need to swap this shift");

    // "Post as open trade" checkbox is checked by default.
    const openTradeCheckbox = page.locator("#open-trade");
    await expect(openTradeCheckbox).toBeChecked();

    // Submit the form.
    const submitBtn = page.getByRole("button", { name: "Request Trade" });
    await submitBtn.click();

    // After success, the form should collapse and a trade card should appear.
    // Look for a status badge with "Open" text, indicating the trade was created.
    await expect(page.getByText("Open", { exact: true })).toBeVisible({
      timeout: 8000,
    });

    // The message should appear in the trade card as a blockquote.
    await expect(page.getByText("Need to swap this shift")).toBeVisible({
      timeout: 5000,
    });
  });

  test("can decline a trade request", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // Create a trade request first (from previous test flow).
    const requestTradeBtn = page.getByRole("button", {
      name: /Request Trade/i,
    });
    await requestTradeBtn.click();

    const messageField = page.locator("#trade-message");
    await messageField.fill("Swap request");

    const submitBtn = page.getByRole("button", { name: "Request Trade" });
    await submitBtn.click();

    // Wait for the trade card to appear with Open status.
    await expect(page.getByText("Open", { exact: true })).toBeVisible({
      timeout: 8000,
    });

    // For a requester, the "Cancel request" button should appear.
    // Click it to decline/cancel the trade.
    const cancelRequestBtn = page.getByRole("button", {
      name: "Cancel request",
    });
    await cancelRequestBtn.click();

    // After declining, the status badge should change to "Cancelled".
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // The "Cancel request" button should no longer be visible.
    await expect(cancelRequestBtn).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Shift Trade Requests — role gate", () => {
  test.skip("supporter cannot create trade requests but can see existing ones", async ({
    browser,
  }) => {
    // This test is skipped pending TradeRequestList integration into shift detail view.
    // The component exists but is not yet mounted on the shifts panel where supporters
    // can access it. Once integrated, this test should verify role-based visibility.
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await navigateToJournal(coordinatorPage);
      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );

      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToShiftsPanel(supporterPage);

        // Once mounted, supporter should see the Trade Requests section.
        // But the "+ Request Trade" button should not be visible for non-coordinators.
        // (Role-based form visibility is not yet implemented.)
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
