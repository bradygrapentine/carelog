// e2e/contact.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Contact page", () => {
  test("contact page renders form and heading", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: /love to hear from you/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeVisible();
  });

  test("submitting the form shows success state", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/contact");

    await page.fill('[name="name"]', "Test User");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="message"]', "Hello from E2E");

    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Message sent!")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("We reply within 24 hours.")).toBeVisible();
  });

  test("API error shows error message", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "server error" }),
      });
    });

    await page.goto("/contact");

    await page.fill('[name="name"]', "Test User");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="message"]', "Hello from E2E");

    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 5000,
    });
  });

  test("FAQ items are visible", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByText("Is my family's data private?")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Can I cancel anytime?")).toBeVisible();
  });
});
