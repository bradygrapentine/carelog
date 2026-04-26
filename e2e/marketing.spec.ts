import { test, expect } from "@playwright/test";

test.describe("Marketing pages", () => {
  test("landing page loads with CareSync branding and hero content", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CareSync/, { timeout: 10000 });
    await expect(page.getByText(/Get started|CareSync/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("pricing page shows plan details", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByText("Simple pricing for the whole family"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("$14")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Family Plan")).toBeVisible({ timeout: 10000 });
  });

  test("about page loads with content", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1, h2, h3, p").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("privacy page shows Privacy text", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/Privacy/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("terms page shows Terms text", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByText(/Terms/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
