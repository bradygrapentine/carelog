// e2e/documents.spec.ts
import * as path from "path";
import { test, expect } from "@playwright/test";
import {
  signIn,
  clearMailpit,
  navigateToJournal,
  sendInviteAndGetUrl,
  acceptInviteAsNewUser,
} from "./helpers";

const COORDINATOR_EMAIL = "e2e-documents@test.com";

function roleEmail(role: string) {
  return "e2e-doc-" + role + "-" + Date.now() + "@test.com";
}

async function goToDocumentsTab(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  // TODO: add data-testid="documents-tab" to the tab component
  await page.getByRole("tab", { name: /documents|vault/i }).click();
  await expect(page).toHaveURL(/panel=documents/, { timeout: 8000 });
}

/** Creates a minimal in-memory PDF blob as a temp file for upload tests. */
async function uploadTestPdf(page: import("@playwright/test").Page) {
  // Use a small text file as a stand-in if no real PDF is available;
  // the upload button accepts application/pdf so we use the fixture path.
  // TODO: add e2e/fixtures/test.pdf for a real PDF fixture
  const fixturePath = path.join(__dirname, "setup", "test.pdf");

  // TODO: add data-testid="upload-document-btn" to component
  const uploadBtn = page.getByRole("button", { name: /upload|add document/i });
  await expect(uploadBtn).toBeVisible({ timeout: 8000 });

  // Use file chooser interception
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadBtn.click(),
  ]);
  await fileChooser.setFiles(fixturePath);

  // Optionally fill in a display name if prompted
  // TODO: add data-testid="document-display-name-input" to component
  const nameInput = page.getByPlaceholder(/document name|file name/i);
  if ((await nameInput.count()) > 0) {
    await nameInput.fill("E2E Test Document");
  }

  const confirmBtn = page.getByRole("button", { name: /upload|save|confirm/i });
  if ((await confirmBtn.count()) > 0) {
    await confirmBtn.click();
  }
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Documents vault", () => {
  test("coordinator uploads a PDF — appears in the vault", async ({ page }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsTab(page);
    await uploadTestPdf(page);

    // TODO: add data-testid="document-row" to each document list item
    await expect(page.getByText(/E2E Test Document|test\.pdf/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("caregiver sees uploaded document in the vault", async ({ browser }) => {
    const email = roleEmail("caregiver");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToDocumentsTab(coordinatorPage);
      await uploadTestPdf(coordinatorPage);
      await expect(
        coordinatorPage.getByText(/E2E Test Document|test\.pdf/i),
      ).toBeVisible({ timeout: 10000 });

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "caregiver",
      );
      const { page: caregiverPage, ctx: caregiverCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToDocumentsTab(caregiverPage);
        await expect(
          caregiverPage.getByText(/E2E Test Document|test\.pdf/i),
        ).toBeVisible({ timeout: 10000 });
      } finally {
        await caregiverCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("supporter sees uploaded document in the vault", async ({ browser }) => {
    const email = roleEmail("supporter");
    const coordinatorCtx = await browser.newContext();
    const coordinatorPage = await coordinatorCtx.newPage();

    try {
      await signIn(coordinatorPage, COORDINATOR_EMAIL);
      await goToDocumentsTab(coordinatorPage);
      await uploadTestPdf(coordinatorPage);
      await expect(
        coordinatorPage.getByText(/E2E Test Document|test\.pdf/i),
      ).toBeVisible({ timeout: 10000 });

      const inviteUrl = await sendInviteAndGetUrl(
        coordinatorPage,
        email,
        "supporter",
      );
      const { page: supporterPage, ctx: supporterCtx } =
        await acceptInviteAsNewUser(browser, inviteUrl, email);

      try {
        await goToDocumentsTab(supporterPage);
        await expect(
          supporterPage.getByText(/E2E Test Document|test\.pdf/i),
        ).toBeVisible({ timeout: 10000 });
        // Supporters should not see an upload button
        await expect(
          supporterPage.getByRole("button", { name: /upload|add document/i }),
        ).not.toBeVisible();
      } finally {
        await supporterCtx.close();
      }
    } finally {
      await coordinatorCtx.close();
    }
  });

  test("download signed URL resolves (status 200 or 302)", async ({
    page,
    request,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsTab(page);
    await uploadTestPdf(page);

    // TODO: add data-testid="document-download-link" to component
    const downloadLink = page
      .getByRole("link", { name: /download|view/i })
      .first();
    await expect(downloadLink).toBeVisible({ timeout: 10000 });

    const href = await downloadLink.getAttribute("href");
    expect(href).toBeTruthy();

    if (href) {
      const response = await request.get(href, { maxRedirects: 0 });
      expect([200, 302]).toContain(response.status());
    }
  });

  test("coordinator deletes a document — removed from vault", async ({
    page,
  }) => {
    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsTab(page);
    await uploadTestPdf(page);

    await expect(page.getByText(/E2E Test Document|test\.pdf/i)).toBeVisible({
      timeout: 10000,
    });

    // TODO: add data-testid="document-delete-btn" to each document row
    const docRow = page
      .locator('[data-testid="document-row"]')
      .filter({ hasText: /E2E Test Document|test\.pdf/i })
      .first();

    if ((await docRow.count()) > 0) {
      await docRow.getByRole("button", { name: /delete|remove/i }).click();
      // Confirm dialog if present
      const confirmBtn = page.getByRole("button", {
        name: /confirm|yes|delete/i,
      });
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click();
      }
      await expect(
        page.getByText(/E2E Test Document|test\.pdf/i),
      ).not.toBeVisible({ timeout: 8000 });
    } else {
      // Fallback: find delete button near the document text
      const deleteBtn = page
        .locator("li, tr")
        .filter({ hasText: /E2E Test Document|test\.pdf/i })
        .getByRole("button", { name: /delete|remove/i })
        .first();
      await deleteBtn.click();
      await expect(
        page.getByText(/E2E Test Document|test\.pdf/i),
      ).not.toBeVisible({ timeout: 8000 });
    }
  });
});
