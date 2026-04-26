import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


test.describe("Outer Circle coordinator creation", () => {
  test.beforeEach(async () => {
    await clearMailpit();
  });

  test("coordinator sees Volunteer requests panel under Team destination", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-outer-circle");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.getByRole("tab", { name: "Team" }).click();
    await expect(page.getByText("Volunteer requests")).toBeVisible({
      timeout: 8000,
    });
    await expect(
      page.getByRole("button", { name: "+ New request" }),
    ).toBeVisible();
  });

  test("coordinator opens request form and fills Title field", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-outer-circle");
    await signIn(page, COORDINATOR_EMAIL);
    await navigateToJournal(page);
    await page.getByRole("tab", { name: "Team" }).click();
    await page.getByRole("button", { name: "+ New request" }).click();

    await expect(page.getByLabel(/^Title/)).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Title/).fill("Meals needed this week");

    await expect(
      page.getByRole("button", { name: "Create request" }),
    ).toBeVisible();
  });
});

test.describe("Outer Circle volunteer page", () => {
  test('invalid token shows "This request is no longer available."', async ({
    page,
  }) => {
    await page.route("**/api/outer-circle/bad-token", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ error: "not found" }),
      });
    });

    await page.goto("/care/bad-token");
    await expect(
      page.getByText("This request is no longer available."),
    ).toBeVisible({ timeout: 10000 });
  });

  test('full slots shows "All slots have been filled."', async ({ page }) => {
    await page.route("**/api/outer-circle/full-token", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Grocery run",
          slots_filled: 3,
          slots_total: 3,
        }),
      });
    });

    await page.goto("/care/full-token");
    await expect(page.getByText("All slots have been filled.")).toBeVisible({
      timeout: 10000,
    });
  });

  test("valid token shows form with title and name label", async ({ page }) => {
    await page.route("**/api/outer-circle/valid-tok", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Grocery run",
          slots_filled: 1,
          slots_total: 3,
        }),
      });
    });

    await page.goto("/care/valid-tok");
    await expect(page.getByText("Grocery run")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Claim a slot")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel("Your name")).toBeVisible({ timeout: 10000 });
  });

  test('successful claim shows "Thanks! You\'re helping out."', async ({
    page,
  }) => {
    await page.route("**/api/outer-circle/valid-tok", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Grocery run",
          slots_filled: 1,
          slots_total: 3,
        }),
      });
    });

    await page.route("**/api/outer-circle/valid-tok/claim", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, id: "c1" }),
      });
    });

    await page.goto("/care/valid-tok");
    await page.fill("#claimer-name", "Jane Doe");
    await page.fill("#claimer-email", "jane@example.com");
    await page.getByRole("button", { name: "Claim a slot" }).click();
    await expect(page.getByText("Thanks! You're helping out.")).toBeVisible({
      timeout: 10000,
    });
  });
});
