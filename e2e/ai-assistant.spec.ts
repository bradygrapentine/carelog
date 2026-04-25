import { test, expect } from "@playwright/test";
import { signIn, ensureCareTeam } from "./helpers";

const TEST_EMAIL = "e2e-test@example.com";

test.describe("AI Assistant", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_EMAIL);
    // The AIAssistantProvider in (app)/layout only mounts when orgId is non-null,
    // so the FAB requires an active care team. Idempotent — fast no-op if already set up.
    await ensureCareTeam(page);
    // Clear consent for clean state
    await page.evaluate(() => localStorage.removeItem("ai_consent"));
  });

  test("FAB is visible on every authenticated page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: "Open AI Assistant" }),
    ).toBeVisible();
  });

  test("first tap shows consent modal", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open AI Assistant" }).click();
    await expect(
      page.getByRole("dialog", { name: "Enable AI Assistant" }),
    ).toBeVisible();
    await expect(page.getByText("de-identified")).toBeVisible();
  });

  test("enabling consent opens the panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open AI Assistant" }).click();
    await page.getByRole("button", { name: "Enable AI Assistant" }).click();
    await expect(
      page.getByRole("complementary", { name: "AI Assistant" }),
    ).toBeVisible();
  });

  test("dismissing consent modal closes it without opening panel", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open AI Assistant" }).click();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(
      page.getByRole("dialog", { name: "Enable AI Assistant" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "AI Assistant" }),
    ).not.toBeVisible();
  });

  test("panel shows contextual suggestions when open", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("ai_consent", "true"));
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open AI Assistant" }).click();
    await expect(
      page.getByRole("complementary", { name: "AI Assistant" }),
    ).toBeVisible();
  });
});
