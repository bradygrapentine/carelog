import { test, expect } from "@playwright/test";
import { signIn, clearMailpit } from "./helpers";

const TEST_EMAIL = "e2e-settings-notifs@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test("all notification categories are present", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await page.goto("/settings");
  await page.waitForURL(/\/settings/);

  // Wait for notification section to load
  await expect(
    page.getByRole("switch", { name: "Weekly digest email" })
  ).toBeVisible({ timeout: 10000 });

  // Assert section heading is visible
  await expect(
    page.getByRole("group", { name: "Email notification preferences" })
  ).toBeVisible();
  await expect(page.getByText("Notification preferences")).toBeVisible();

  // Assert all three toggles are visible
  const digestToggle = page.getByRole("switch", {
    name: "Weekly digest email",
  });
  const mentionsToggle = page.getByRole("switch", {
    name: "Mention notifications",
  });
  const shiftsToggle = page.getByRole("switch", { name: "Shift reminders" });

  await expect(digestToggle).toBeVisible();
  await expect(mentionsToggle).toBeVisible();
  await expect(shiftsToggle).toBeVisible();

  // Assert each toggle has a valid aria-checked value
  const digestChecked = await digestToggle.getAttribute("aria-checked");
  const mentionsChecked = await mentionsToggle.getAttribute("aria-checked");
  const shiftsChecked = await shiftsToggle.getAttribute("aria-checked");

  expect(["true", "false"]).toContain(digestChecked);
  expect(["true", "false"]).toContain(mentionsChecked);
  expect(["true", "false"]).toContain(shiftsChecked);
});

test("toggle notification pref, reload, verify persisted", async ({ page }) => {
  await signIn(page, TEST_EMAIL);
  await page.goto("/settings");
  await page.waitForURL(/\/settings/);

  // Wait for toggle to be visible
  const digestToggle = page.getByRole("switch", {
    name: "Weekly digest email",
  });
  await expect(digestToggle).toBeVisible({ timeout: 10000 });

  // Record initial state
  const initialState = await digestToggle.getAttribute("aria-checked");
  expect(["true", "false"]).toContain(initialState);

  // Click toggle and wait for state change
  const expectedState = initialState === "true" ? "false" : "true";
  await digestToggle.click();
  await expect(digestToggle).toHaveAttribute(
    "aria-checked",
    expectedState,
    { timeout: 5000 }
  );

  // Reload the page
  await page.reload();
  await page.waitForURL(/\/settings/);

  // Wait for toggle to be visible again
  const reloadedToggle = page.getByRole("switch", {
    name: "Weekly digest email",
  });
  await expect(reloadedToggle).toBeVisible({ timeout: 10000 });

  // Assert state has flipped
  const reloadedState = await reloadedToggle.getAttribute("aria-checked");
  expect(reloadedState).not.toBe(initialState);
  expect(["true", "false"]).toContain(reloadedState);

  // Flip it back to restore idempotency
  await reloadedToggle.click();
  await expect(reloadedToggle).toHaveAttribute(
    "aria-checked",
    initialState,
    { timeout: 5000 }
  );

  // Verify it's back to initial state
  const finalState = await reloadedToggle.getAttribute("aria-checked");
  expect(finalState).toBe(initialState);
});
