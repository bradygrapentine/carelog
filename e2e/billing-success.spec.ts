import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, uniqueEmail } from "./helpers";

// The (app)/ layout enforces auth — all tests must sign in first.

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Billing success page", () => {
  test("no session_id shows error", async ({ page }) => {
    const EMAIL = uniqueEmail("e2e-billing-success");
    await signIn(page, EMAIL);
    await page.goto("/billing/success");
    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 10000,
    });
  });

  test("valid session shows Welcome to Family Plan", async ({ page }) => {
    const EMAIL = uniqueEmail("e2e-billing-success");
    await signIn(page, EMAIL);
    await page.route("**/api/stripe/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "paid", interval: "month" }),
      });
    });
    await page.goto("/billing/success?session_id=sess_test");
    await expect(page.getByText("Welcome to the Family Plan!")).toBeVisible({
      timeout: 10000,
    });
  });

  test("monthly plan shows $14/mo label", async ({ page }) => {
    const EMAIL = uniqueEmail("e2e-billing-success");
    await signIn(page, EMAIL);
    await page.route("**/api/stripe/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "paid", interval: "month" }),
      });
    });
    await page.goto("/billing/success?session_id=sess_test");
    await expect(page.getByText("$14/mo")).toBeVisible({ timeout: 10000 });
  });

  test("yearly plan shows $120/yr label", async ({ page }) => {
    const EMAIL = uniqueEmail("e2e-billing-success");
    await signIn(page, EMAIL);
    await page.route("**/api/stripe/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "paid", interval: "year" }),
      });
    });
    await page.goto("/billing/success?session_id=sess_test");
    await expect(page.getByText("$120/yr")).toBeVisible({ timeout: 10000 });
  });
});
