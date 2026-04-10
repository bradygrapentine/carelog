import { test, expect } from "@playwright/test";

// Smoke test: verifies the redesigned layout renders without errors
// after a logged-in user navigates to their journal.
// This test requires a seeded test user — see e2e/CLAUDE.md for setup.

test.describe("UI layout smoke", () => {
  test("sidebar rail is present on desktop", async ({ page }) => {
    await page.goto("/signin");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "");
    await page.click('[type="submit"]');
    await page.waitForURL(/\/journal\//);

    await expect(page.getByTestId("sidebar-rail")).toBeVisible();
    await expect(page.getByTestId("top-bar")).toBeVisible();

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("hamburger menu opens sidebar on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/signin");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "");
    await page.click('[type="submit"]');
    await page.waitForURL(/\/journal\//);

    await expect(page.getByTestId("sidebar-rail")).not.toBeVisible();

    const hamburger = page.getByRole("button", { name: /menu/i });
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    await expect(page.getByText("Carelog")).toBeVisible();
  });
});
