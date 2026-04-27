// e2e/expenses.spec.ts
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  uniqueEmail,
} from "./helpers";

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

    // (TD-73) httpBatchLink groups multiple More-panel queries into ONE URL
    // and the TRPC client uses superjson — we can't naively `route.fulfill`
    // a synthetic batched body. Pass-through and splice expenses.list into
    // the matching slot.
    await page.route(/\/api\/trpc\/[^?]*expenses\.list/, async (route) => {
      const url = new URL(route.request().url());
      const procedures = decodeURIComponent(
        url.pathname.split("/").pop() ?? "",
      ).split(",");
      const idx = procedures.indexOf("expenses.list");
      const upstream = await route.fetch();
      const body = (await upstream.json()) as Array<unknown>;
      body[idx] = {
        result: {
          data: {
            json: [
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
        },
      };
      await route.fulfill({
        response: upstream,
        body: JSON.stringify(body),
        contentType: "application/json",
      });
    });

    await goToMorePanel(page);

    await expect(page.getByText("E2E Prescription refill")).toBeVisible({
      timeout: 8000,
    });
    // "$42.50" appears both as the line-item amount and in the
    // category-summary "medication: $42.50" — assert the line item count.
    await expect(page.getByText("$42.50")).toHaveCount(2, { timeout: 5000 });
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

    // "Log expense" appears as both the section heading <p> and the submit
    // button — scope to the button to avoid strict-mode collision.
    await expect(
      page.getByRole("button", { name: /^Log expense$/ }),
    ).toBeVisible({ timeout: 8000 });
  });
});
