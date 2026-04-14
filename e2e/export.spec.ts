// e2e/export.spec.ts  (ON-04)
// Covers ExportButton.tsx — rendered inside the "More" panel, coordinator-only.
// Uses page.route() to intercept /api/export so no real server export is needed.
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-export@test.com";

function roleEmail(role: string) {
  return "e2e-exp-" + role + "-" + Date.now() + "@test.com";
}

/** Navigate to the More panel which contains ExportButton (coordinator-only). */
async function goToMorePanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("button", { name: "More" }).click();
  // Wait for the More panel to render — SymptomPanel always appears for all roles.
  await expect(
    page
      .getByText("Symptoms")
      .or(page.getByText("How are you doing this week?")),
  ).toBeVisible({
    timeout: 8000,
  });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Export button — coordinator", () => {
  test("coordinator sees ExportButton card with 'Export full history' heading", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Export full history")).toBeVisible({
      timeout: 8000,
    });
    await expect(
      page.getByRole("button", { name: "Download export" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("coordinator can trigger export — mocked /api/export returns fake blob", async ({
    page,
  }) => {
    // Intercept the export API before navigating so the route is registered early.
    await page.route("**/api/export", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Export full history")).toBeVisible({
      timeout: 8000,
    });

    // Click the JSON format button to ensure it is selected (it is the default).
    await page.getByRole("button", { name: "JSON" }).click();

    // Submit the form — the intercepted route returns immediately.
    await page.getByRole("button", { name: "Download export" }).click();

    // The button should re-enable after the (mocked) round-trip.
    await expect(
      page.getByRole("button", { name: "Download export" }),
    ).toBeEnabled({ timeout: 8000 });
  });

  test("export error message shown when API returns non-OK", async ({
    page,
  }) => {
    await page.route("**/api/export", (route) => {
      route.fulfill({ status: 500, body: "Internal Server Error" });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await expect(page.getByText("Export full history")).toBeVisible({
      timeout: 8000,
    });

    await page.getByRole("button", { name: "Download export" }).click();

    await expect(
      page.getByText("Export failed. Please try again."),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Export button — role gate", () => {
  test("supporter does not see ExportButton", async ({ browser }) => {
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await navigateToJournal(coordinatorPage);
      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );

      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMorePanel(supporterPage);

        // ExportButton returns null for non-coordinators — heading must be absent.
        await expect(
          supporterPage.getByText("Export full history"),
        ).not.toBeVisible({ timeout: 5000 });
        await expect(
          supporterPage.getByRole("button", { name: "Download export" }),
        ).not.toBeVisible({ timeout: 3000 });
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("caregiver does not see ExportButton", async ({ browser }) => {
    const email = roleEmail("caregiver");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await navigateToJournal(coordinatorPage);
      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "caregiver",
      );

      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToMorePanel(caregiverPage);

        await expect(
          caregiverPage.getByText("Export full history"),
        ).not.toBeVisible({ timeout: 5000 });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });
});
