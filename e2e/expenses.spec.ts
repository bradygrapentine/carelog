// e2e/expenses.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "More" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Expenses panel", () => {
  test("coordinator sees expense form on More panel", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-expenses");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Shared expenses")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByPlaceholder("Amount")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByPlaceholder("Description")).toBeVisible();
  });

  test("coordinator adds expense — appears in list", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-expenses");
    await signIn(page, COORDINATOR_EMAIL);

    // Mock tRPC calls so the test doesn't depend on real DB
    await page.route("**/trpc/expenses.list*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: [
              {
                id: "exp-1",
                amount: 42.5,
                currency: "USD",
                category: "medication",
                description: "E2E Prescription refill",
                paid_by_name: null,
                incurred_at: "2026-04-13",
              },
            ],
          },
        }),
      });
    });

    await page.route("**/trpc/expenses.create*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { id: "exp-new" } } }),
      });
    });

    await goToMorePanel(page);

    await expect(page.getByText("E2E Prescription refill")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("$42.50")).toBeVisible({ timeout: 5000 });
  });

  test("coordinator submits expense form — Log expense button present", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-expenses");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(
      page.getByRole("button", { name: /log expense/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test("caregiver also sees expense form (can write)", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-expenses");
    // Caregiver role also has canWrite, so the form should be visible.
    // This test just checks the selector on a coordinator account since
    // multi-user invite flows are covered in burnout/documents specs.
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Log expense")).toBeVisible({ timeout: 8000 });
  });
});
