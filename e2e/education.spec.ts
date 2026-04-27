import { test, expect } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

test.describe("Education library", () => {
  test.beforeEach(async ({ page }) => {
    const TEST_EMAIL = uniqueEmail("edu");
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
    // (TD-73) The Education tab lives in the journal-context AppTabBar
    // (only renders inside /journal/[id]) — not the dashboard. Navigate
    // through the journal first so the tablist is mounted.
    const TEST_EMAIL = uniqueEmail("edu-nav");
    await signIn(page, TEST_EMAIL);
    const { ensureCareTeam } = await import("./helpers");
    await ensureCareTeam(page);
    await page.click('text="View care journal"');
    await page.waitForURL(/\/journal\//, { timeout: 15_000 });
    await page.getByRole("tab", { name: "Education" }).click();
    await expect(page).toHaveURL(/\/education/);
  });
});
