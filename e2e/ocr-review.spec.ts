// e2e/ocr-review.spec.ts
// OcrReviewPanel is rendered inside the Documents panel for coordinators.
// All API calls are mocked via page.route so no live OCR backend is needed.
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal, uniqueEmail } from "./helpers";


async function goToDocumentsPanel(page: import("@playwright/test").Page) {
  await navigateToJournal(page);
  await page.getByRole("tab", { name: "Documents" }).click();
}

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("OCR review panel", () => {
  test("coordinator sees Scan prescription label heading", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-ocr");
    await page.route("**/api/ocr/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsPanel(page);

    await expect(page.getByText("Scan prescription label")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByRole("button", { name: "Scan label" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("empty jobs list shows No scans pending review", async ({ page }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-ocr");
    await page.route("**/api/ocr/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsPanel(page);

    await expect(page.getByText("No scans pending review.")).toBeVisible({
      timeout: 8000,
    });
  });

  test("pending OCR job shows editable fields and Confirm/Discard buttons", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-ocr");
    await page.route("**/api/ocr/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: [
            {
              id: "job-1",
              recipient_id: "rec-1",
              image_url: "https://example.com/label.jpg",
              raw_text: "Lisinopril 10mg take once daily",
              parsed_payload: {
                drug_name: "Lisinopril",
                dosage: "10mg",
                instructions: "take once daily",
              },
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsPanel(page);

    // Editable drug name field pre-filled from parsed_payload
    await expect(page.getByDisplayValue("Lisinopril")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByDisplayValue("10mg")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Discard")).toBeVisible({ timeout: 5000 });
  });

  test("Confirm button fires /api/ocr/confirm and removes job from list", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-ocr");
    let confirmCalled = false;

    await page.route("**/api/ocr/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: [
            {
              id: "job-2",
              recipient_id: "rec-1",
              image_url: "https://example.com/label2.jpg",
              raw_text: "Metformin 500mg",
              parsed_payload: {
                drug_name: "Metformin",
                dosage: "500mg",
                instructions: "twice daily",
              },
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route("**/api/ocr/confirm", async (route) => {
      confirmCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToDocumentsPanel(page);

    await expect(page.getByDisplayValue("Metformin")).toBeVisible({
      timeout: 8000,
    });
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(async () => {
      expect(confirmCalled).toBe(true);
    }).toPass({ timeout: 5000 });

    // Job removed from list after confirm
    await expect(page.getByDisplayValue("Metformin")).not.toBeVisible({
      timeout: 5000,
    });
  });
});
