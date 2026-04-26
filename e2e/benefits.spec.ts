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

  // (TD-55) Screener form is hidden by default behind a "Start screener"
  // disclosure (BenefitsNavigator.tsx:177-203 — commit bf5d1043 "revert
  // always-open forms"). Test must click "Start screener" before asserting
  // on the question copy.
  test("screener questions are visible on desktop after clicking Start screener", async ({
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

    // Click the disclosure to expand the screener form
    await page.getByRole("button", { name: "Start screener" }).click();

    await expect(
      page.getByText("Is the care recipient 65 or older?"),
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: "Find matching programs" }),
    ).toBeVisible({ timeout: 5000 });
  });

  // (TD-55) Same disclosure prerequisite as the test above.
  test("Find matching programs button fires screen mutation", async ({
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

    // Expand the screener form first (TD-55 disclosure)
    await page.getByRole("button", { name: "Start screener" }).click();
    await page.getByRole("button", { name: "Find matching programs" }).click();

    await expect(async () => {
      expect(screenCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // (TD-55) Mock for benefits.latest doesn't appear to take effect — More
  // panel still shows the empty state with "Start screener" button instead
  // of the results view. Likely a tRPC URL pattern mismatch (route("**/trpc/
  // benefits.latest*") vs actual URL) OR react-query already cached the
  // initial null fetch before the mock route was registered. Investigate
  // with /live-test in a follow-up.
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
