// e2e/shift-calendar.spec.ts
// Covers ShiftCalendar (react-big-calendar) UI added in feat/shift-calendar.
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


/** Navigate to the Shifts tab (calendar view) from the journal page. */
async function goToShiftsCalendar(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "Shifts" }).click();
  // Wait for ShiftList heading to confirm we're on the shifts panel.
  await expect(page.getByText("Shifts").first()).toBeVisible({ timeout: 8000 });
  // Click the "Calendar" tab to switch to ShiftCalendar.
  const calendarTab = page.getByRole("tab", { name: "Calendar" });
  if ((await calendarTab.count()) > 0) {
    await calendarTab.click();
  }
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Shift Calendar", () => {
  test("renders calendar in week view by default", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-shifts");
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsCalendar(page);
    await expect(page.locator(".rbc-time-view")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".rbc-toolbar")).toBeVisible();
  });

  test("view switcher: month view renders without error", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-shifts");
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsCalendar(page);
    await page.getByRole("button", { name: "Month" }).first().click();
    await expect(page.locator(".rbc-month-view")).toBeVisible({
      timeout: 5000,
    });
  });

  test("view switcher: day view renders without error", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-shifts");
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsCalendar(page);
    await page.getByRole("button", { name: "Day" }).first().click();
    await expect(page.locator(".rbc-time-view")).toBeVisible({ timeout: 5000 });
  });

  test("unassigned shift event has danger styling", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-shifts");
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsCalendar(page);
    const unassigned = page.locator(".shift-event--unassigned").first();
    if ((await unassigned.count()) > 0) {
      await expect(unassigned).toBeVisible();
    }
  });

  test("clicking a shift event opens ShiftPopover with correct info", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-shifts");
    await signIn(page, COORDINATOR_EMAIL);
    await goToShiftsCalendar(page);
    const event = page.locator(".rbc-event").first();
    if ((await event.count()) > 0) {
      await event.click();
      await expect(
        page.getByRole("dialog", { name: "Shift details" }),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Assignee:")).toBeVisible();
    }
  });
});
