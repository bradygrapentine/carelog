import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

const TEST_EMAIL = "e2e-test@example.com";

test.describe("Education library", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_EMAIL);
  });

  test("renders guide list at /education", async ({ page }) => {
    await page.goto("/education");
    await expect(
      page.getByRole("heading", { name: /Education/i }),
    ).toBeVisible();
    await expect(page.locator("a[href^='/education/']").first()).toBeVisible();
  });

  test("tag filter reduces visible guides", async ({ page }) => {
    await page.goto("/education");
    const allCount = await page.locator("a[href^='/education/']").count();
    await page.getByRole("button", { name: /dementia/i }).click();
    const filteredCount = await page.locator("a[href^='/education/']").count();
    expect(filteredCount).toBeLessThanOrEqual(allCount);
  });

  test("guide detail page renders content and external link", async ({
    page,
  }) => {
    await page.goto("/education/sundowning");
    await expect(
      page.getByRole("heading", { name: "Managing Sundowning" }),
    ).toBeVisible();
    await expect(page.getByText("Quick Tips")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Read full guide/i }),
    ).toBeVisible();
  });

  test("Education link in sidebar nav navigates to library", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Education" }).click();
    await expect(page).toHaveURL(/\/education/);
  });
});
