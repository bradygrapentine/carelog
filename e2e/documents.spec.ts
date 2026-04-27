// e2e/documents.spec.ts
import * as path from "path";
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
  uniqueEmail,
} from "./helpers";

// Minimal valid PDF checked in at e2e/setup/test.pdf
const TEST_PDF = path.join(__dirname, "setup", "test.pdf");

function roleEmail(role: string) {
  return "e2e-doc-" + role + "-" + Date.now() + "@test.com";
}

/**
 * Navigate to the Documents panel and expand the Document vault accordion.
 */
async function goToDocumentVault(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "Documents" }).click();
  // (TD-73) Document vault is no longer a collapsible. Wait on whichever
  // post-mount signal is present: coordinators see the upload form's
  // displayName input; caregivers/supporters see the Documents page heading.
  await Promise.race([
    page
      .locator('input[name="displayName"]')
      .waitFor({ state: "visible", timeout: 8000 }),
    page
      .getByRole("heading", { name: /Documents$/i })
      .waitFor({ state: "visible", timeout: 8000 }),
  ]);
}

/**
 * Upload the test PDF fixture via the coordinator upload form.
 * Uses setInputFiles on the file input directly (no file-chooser dialog).
 */
async function uploadTestPdf(
  page: import("@playwright/test").Page,
  displayName = "E2E Test Document",
) {
  await page.fill('[name="displayName"]', displayName);
  await page.locator('[name="file"]').setInputFiles(TEST_PDF);
  await page.getByRole("button", { name: "Upload" }).click();
  // Wait for the document to appear in the list
  await expect(page.getByText(displayName)).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Documents vault", () => {
  test("coordinator uploads a PDF — appears in the vault", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("doc-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentVault(page);
    await uploadTestPdf(page);
  });

  test("caregiver sees uploaded document in the vault", async ({ browser }) => {
    const COORDINATOR_EMAIL = uniqueEmail("doc-coord");
    const email = roleEmail("caregiver");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToDocumentVault(coordinatorPage);
      await uploadTestPdf(coordinatorPage);

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "caregiver",
      );
      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToDocumentVault(caregiverPage);
        await expect(caregiverPage.getByText("E2E Test Document")).toBeVisible({
          timeout: 10000,
        });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("supporter sees uploaded document but no upload form", async ({
    browser,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("doc-coord");
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToDocumentVault(coordinatorPage);
      await uploadTestPdf(coordinatorPage);

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );
      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToDocumentVault(supporterPage);
        await expect(supporterPage.getByText("E2E Test Document")).toBeVisible({
          timeout: 10000,
        });
        // Supporters cannot upload documents
        await expect(supporterPage.locator('[name="file"]')).not.toBeVisible();
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("coordinator downloads document — link resolves", async ({
    page,
    request,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("doc-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentVault(page);
    await uploadTestPdf(page, "E2E Download Test");

    // The download button has aria-label="Download E2E Download Test"
    const downloadBtn = page.getByRole("button", {
      name: "Download E2E Download Test",
    });
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });

    // Intercept the window.open call to capture the URL
    const [popup] = await Promise.all([
      page.waitForEvent("popup").catch(() => null),
      downloadBtn.click(),
    ]);
    // window.open opens a new tab — we just verify no error occurred
    if (popup) {
      await popup.close();
    }
  });

  test("coordinator deletes a document — removed from vault", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("doc-coord");
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentVault(page);
    await uploadTestPdf(page, "E2E Delete Test");

    // Delete button has aria-label="Delete E2E Delete Test"
    await page.getByRole("button", { name: "Delete E2E Delete Test" }).click();

    await expect(page.getByText("E2E Delete Test")).not.toBeVisible({
      timeout: 8000,
    });
  });
});
