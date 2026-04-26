// e2e/navigation.spec.ts
import { test, expect } from "@playwright/test";
import { checkA11y } from "./helpers";

// Navigate to the journal page from dashboard — reused across all tests
async function goToJournal(page: any) {
  await page.goto("/dashboard");
  await page.waitForSelector('text="View care journal"', {
    timeout: 15000,
  });
  await page.click('text="View care journal"');
  await page.waitForURL(/\/journal\/[^/]+/, { timeout: 15000 });
  // Confirm default panel loaded
  await page.waitForSelector('[placeholder="Share how today went..."]', {
    timeout: 10000,
  });
}

test.describe("Panel tab navigation", () => {
  test("default panel is Journal — entry form visible", async ({ page }) => {
    await goToJournal(page);
    await expect(
      page.getByPlaceholder("Share how today went..."),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Journal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await checkA11y(page);
  });

  test("Medications tab — panel heading visible and URL updated", async ({
    page,
  }) => {
    await goToJournal(page);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.click('button[aria-label="Medications"]');
    await expect(page).toHaveURL(/[?&]panel=medications/, { timeout: 8000 });
    await expect(
      page.getByRole("tab", { name: "Medications" }),
    ).toHaveAttribute("aria-selected", "true");
    // Panel renders its collapsed heading button
    await expect(
      page.getByRole("button", { name: /Medications/i }).last(),
    ).toBeVisible({ timeout: 5000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("Team tab — care team heading visible and URL updated", async ({
    page,
  }) => {
    await goToJournal(page);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.click('button[aria-label="Team"]');
    await expect(page).toHaveURL(/[?&]panel=team/, { timeout: 8000 });
    await expect(page.getByRole("tab", { name: "Team" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Care team")).toBeVisible({ timeout: 5000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("Shifts tab — panel content visible and URL updated", async ({
    page,
  }) => {
    await goToJournal(page);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.click('button[aria-label="Shifts"]');
    await expect(page).toHaveURL(/[?&]panel=shifts/, { timeout: 8000 });
    await expect(page.getByRole("tab", { name: "Shifts" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // ShiftForm renders a "+ Schedule a shift" trigger regardless of data
    await expect(
      page.getByText(/Schedule a shift|Upcoming shifts/i),
    ).toBeVisible({ timeout: 5000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("Documents tab — panel content visible and URL updated", async ({
    page,
  }) => {
    await goToJournal(page);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.click('button[aria-label="Documents"]');
    await expect(page).toHaveURL(/[?&]panel=documents/, { timeout: 8000 });
    await expect(
      page.getByRole("tab", { name: "Documents" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/Document vault/i)).toBeVisible({
      timeout: 5000,
    });
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("More tab — panel content visible and URL updated", async ({ page }) => {
    await goToJournal(page);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.click('button[aria-label="More"]');
    await expect(page).toHaveURL(/[?&]panel=more/, { timeout: 8000 });
    await expect(page.getByRole("tab", { name: "More" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // More panel renders OCR review + symptom panels
    await expect(page.getByText(/Symptom readings|Scan label/i)).toBeVisible({
      timeout: 5000,
    });
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("tab navigation is reversible — can return to Journal from Medications", async ({
    page,
  }) => {
    await goToJournal(page);
    await page.click('button[aria-label="Medications"]');
    await expect(page).toHaveURL(/panel=medications/, { timeout: 8000 });

    await page.click('button[aria-label="Journal"]');
    await expect(page).toHaveURL(/panel=journal/, { timeout: 8000 });
    await expect(page.getByPlaceholder("Share how today went...")).toBeVisible({
      timeout: 5000,
    });
  });

  test("URL panel param preserved on page reload", async ({ page }) => {
    await goToJournal(page);
    await page.click('button[aria-label="Team"]');
    await expect(page).toHaveURL(/panel=team/, { timeout: 8000 });

    await page.reload();
    await expect(page).toHaveURL(/panel=team/);
    await expect(page.getByText("Care team")).toBeVisible({ timeout: 10000 });
  });
});
