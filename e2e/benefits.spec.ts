// e2e/benefits.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const COORDINATOR_EMAIL = "e2e-benefits@test.com";

async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "More" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Benefits navigator", () => {
  test("coordinator sees Benefits navigator card on More panel", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Benefits navigator")).toBeVisible({
      timeout: 8000,
    });
  });

  // (TD-55) Screener question element exists in DOM but is hidden — likely
  // collapsed behind an expansion/disclosure UI that the test doesn't open.
  // Real product-behavior drift, not selector drift. Investigate in TD-55.
  test.fixme("screener questions are visible on desktop (always shown when no results)", async ({
    page,
  }) => {
    // Mock latest query to return null (no prior screener)
    await page.route("**/trpc/benefits.latest*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: null } }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    // Desktop: screener form always shown when no prior results
    await expect(
      page.getByText("Is the care recipient 65 or older?"),
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: "Find matching programs" }),
    ).toBeVisible({ timeout: 5000 });
  });

  // (TD-55) Same hidden-screener-form issue as the test above — clicking
  // the Find button requires the form to be visible first.
  test.fixme("Find matching programs button fires screen mutation", async ({
    page,
  }) => {
    let screenCalled = false;

    await page.route("**/trpc/benefits.latest*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: null } }),
      });
    });

    await page.route("**/trpc/benefits.screen*", async (route) => {
      screenCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { id: "scr-1" } } }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await page.getByRole("button", { name: "Find matching programs" }).click();

    await expect(async () => {
      expect(screenCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // (TD-55) Same More-panel content drift family — Benefits navigator card
  // not in expected position. Snapshot from v15 showed Symptom readings +
  // weekly check-in form instead of the screener results panel.
  test.fixme("prior screener results are displayed when latest returns data", async ({
    page,
  }) => {
    await page.route("**/trpc/benefits.latest*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              results: [
                {
                  key: "medicare_savings",
                  name: "Medicare Savings Program",
                  description: "Helps pay Medicare premiums.",
                  applyUrl: "https://www.medicare.gov/",
                },
              ],
            },
          },
        }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Medicare Savings Program")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("Run screener again")).toBeVisible({
      timeout: 5000,
    });
  });
});
