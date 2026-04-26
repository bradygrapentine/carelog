import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, checkA11y } from "./helpers";

// Smoke test: verifies the redesigned layout renders without errors
// after a logged-in user navigates to their journal.

const SMOKE_EMAIL = "e2e-smoke@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("UI layout smoke", () => {
  test("sidebar rail is present on desktop", async ({ page }) => {
    await signIn(page, SMOKE_EMAIL);
    await navigateToJournal(page);

    await expect(page.getByTestId("sidebar-rail")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("top-bar")).toBeVisible({ timeout: 10000 });

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
    await checkA11y(page);
  });

  test("hamburger menu opens sidebar on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, SMOKE_EMAIL);
    await navigateToJournal(page);

    await expect(page.getByTestId("sidebar-rail")).not.toBeVisible({
      timeout: 10000,
    });

    const hamburger = page.getByRole("button", { name: /menu/i });
    await expect(hamburger).toBeVisible({ timeout: 10000 });

    await hamburger.click();
    await expect(page.getByText("CareSync")).toBeVisible({ timeout: 5000 });
  });
});
