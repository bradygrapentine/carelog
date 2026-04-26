// e2e/care-brief.spec.ts
// Tests the "Generate shareable brief" button in the coordinator More panel.
// The /api/brief POST is mocked so the test runs without a live AI backend.
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const COORDINATOR_EMAIL = "e2e-carebrief@test.com";

async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "More" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Care brief generation", () => {
  test("coordinator sees Generate shareable brief button on More panel", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Care brief")).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: /generate shareable brief/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking Generate shareable brief — share URL appears after mock response", async ({
    page,
  }) => {
    const SHARE_TOKEN = "e2e-brief-tok-123";

    await page.route("**/api/brief", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ share_token: SHARE_TOKEN }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await page
      .getByRole("button", { name: /generate shareable brief/i })
      .click();

    // After the mocked POST resolves, the share URL should appear in the panel
    await expect(page.getByText(new RegExp(SHARE_TOKEN))).toBeVisible({
      timeout: 8000,
    });
  });

  test("button shows Generating... while request is in-flight", async ({
    page,
  }) => {
    // Delay the mock response so we can catch the loading state
    await page.route("**/api/brief", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ share_token: "tok-slow" }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await page
      .getByRole("button", { name: /generate shareable brief/i })
      .click();

    await expect(page.getByText("Generating...")).toBeVisible({
      timeout: 3000,
    });
  });
});
