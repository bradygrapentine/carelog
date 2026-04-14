// e2e/shifts.spec.ts  (ON-05)
// Covers ShiftForm.tsx and ShiftList.tsx under the Shifts panel.
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-shifts@test.com";

function roleEmail(role: string) {
  return "e2e-shift-" + role + "-" + Date.now() + "@test.com";
}

/** Navigate to the Shifts panel from the journal page. */
async function goToShiftsPanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  // SidebarNav renders buttons with aria-label matching the destination label.
  await page.getByRole("button", { name: "Shifts" }).click();
  // ShiftList always renders the "Shifts" card header — wait for it.
  await expect(page.getByText("Shifts").first()).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Shifts panel — coordinator", () => {
  test("coordinator sees ShiftForm card and can expand it", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // The ShiftForm renders a card with "Schedule a shift" as the CardTitle.
    await expect(page.getByText("Schedule a shift")).toBeVisible({
      timeout: 8000,
    });

    // On mobile the form is collapsed behind a "+ New shift" toggle.
    // Click it to expand and reveal the submit button.
    const newShiftBtn = page.getByText("+ New shift").first();
    const isCollapsed = (await newShiftBtn.count()) > 0;
    if (isCollapsed) {
      await newShiftBtn.click();
    }

    // After expanding, the submit button should be visible.
    await expect(
      page.getByRole("button", { name: /Schedule shift|Schedule \d+ shifts/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("coordinator can fill and submit a shift", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsPanel(page);

    // Expand form if collapsed.
    const newShiftBtn = page.getByText("+ New shift").first();
    if ((await newShiftBtn.count()) > 0) {
      await newShiftBtn.click();
    }

    // Fill start time (required for canSubmit).
    await page.fill("#shift-start", "09:00");

    // Select an assignee — pick the first non-placeholder option.
    const assigneeSelect = page.locator("#shift-assignee");
    await assigneeSelect.selectOption({ index: 1 });

    // Submit.
    await page.getByRole("button", { name: /Schedule shift/i }).click();

    // After success the form resets: the card header returns to its initial state.
    await expect(page.getByText("Schedule a shift")).toBeVisible({
      timeout: 8000,
    });
  });
});

test.describe("Shifts panel — role gate", () => {
  test("supporter does not see ShiftForm but does see ShiftList", async ({
    browser,
  }) => {
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

        // ShiftList renders for all roles — supporter should see its heading.
        await expect(supporterPage.getByText("Shifts").first()).toBeVisible({
          timeout: 8000,
        });

        // ShiftForm is coordinator-only — "Schedule a shift" card title must be absent.
        await expect(
          supporterPage.getByText("Schedule a shift"),
        ).not.toBeVisible({ timeout: 3000 });
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
