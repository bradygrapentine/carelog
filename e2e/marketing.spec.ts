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
    // Pricing page now mentions "$14" in the hero price AND in 2 FAQ
    // answers; loose getByText hits a strict-mode violation. Scope to
    // the hero price tag (Tailwind text-4xl is unique to the price
    // element on this page).
    await expect(page.locator("span.text-4xl", { hasText: "$14" })).toBeVisible(
      { timeout: 10000 },
    );
    // (TD-73) "Family Plan" appears as both heading and body copy ("One
    // family plan covers…") — scope to the heading.
    await expect(
      page.getByRole("heading", { name: "Family Plan" }),
    ).toBeVisible({ timeout: 10000 });
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
