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

  test("prior screener results are displayed when latest returns data", async ({
    page,
  }) => {
    // The httpBatchLink groups multiple More-panel queries into ONE URL like
    // `/api/trpc/symptoms.list,burnout.orgSummary,...,benefits.latest?batch=1&input=...`
    // and returns one array element per procedure (in input order). We can't
    // synthesise the entire batched response — sibling components depend on
    // their real data. So pass through to the server, then splice OUR
    // benefits.latest payload into the correct slot.
    //
    // The TRPC client uses `transformer: superjson` (TrpcProvider.tsx:27),
    // so the `data` field MUST be wrapped in `{ json: ... }`.
    await page.route(/\/api\/trpc\/[^?]*benefits\.latest/, async (route) => {
      const url = new URL(route.request().url());
      const procedures = decodeURIComponent(
        url.pathname.split("/").pop() ?? "",
      ).split(",");
      const benefitsIdx = procedures.indexOf("benefits.latest");

      const upstream = await route.fetch();
      const body = (await upstream.json()) as Array<unknown>;
      body[benefitsIdx] = {
        result: {
          data: {
            json: {
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
        },
      };
      await route.fulfill({
        response: upstream,
        body: JSON.stringify(body),
        contentType: "application/json",
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
