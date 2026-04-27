// e2e/eol-planner.spec.ts
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

test.describe("EolPlanner", () => {
  test("coordinator sees End-of-life plan card on More panel", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-eolplanner");
    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    // (TD-73) "End-of-life plan" matches both the card title and helper
    // copy "...end-of-life plan on file yet" — assert the role gate
    // ("Coordinator only") which is unique.
    await expect(page.getByText("Coordinator only")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("Coordinator only")).toBeVisible({
      timeout: 5000,
    });
  });

  test("coordinator can open the plan form via Create plan button", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-eolplanner");
    // Mock tRPC so the plan query returns null (no plan on file yet)
    await page.route("**/trpc/eolPlan.get*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: null } }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    // The "Create plan" button appears when no plan exists
    await expect(page.getByRole("button", { name: "Create plan" })).toBeVisible(
      { timeout: 8000 },
    );
    await page.getByRole("button", { name: "Create plan" }).click();

    // Form fields should now be visible
    await expect(
      page.getByPlaceholder("e.g. Jane Smith — 555-0199"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Save plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("coordinator fills and submits EOL plan — Save plan button fires mutation", async ({
    page,
  }) => {
    const COORDINATOR_EMAIL = uniqueEmail("e2e-eolplanner");
    let upsertCalled = false;

    await page.route("**/trpc/eolPlan.get*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: null } }),
      });
    });

    await page.route("**/trpc/eolPlan.upsert*", async (route) => {
      upsertCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              healthcare_proxy: "Jane Smith — 555-0199",
              resuscitation_pref: "dnr",
              funeral_pref: null,
              legacy_message: null,
              attorney_name: null,
              attorney_contact: null,
            },
          },
        }),
      });
    });

    // Mock the invalidation re-fetch after upsert
    await page.route("**/trpc/eolPlan.get*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              healthcare_proxy: "Jane Smith — 555-0199",
              resuscitation_pref: "dnr",
              funeral_pref: null,
              legacy_message: null,
              attorney_name: null,
              attorney_contact: null,
            },
          },
        }),
      });
    });

    await signIn(page, COORDINATOR_EMAIL);
    await goToMorePanel(page);

    await page.getByRole("button", { name: "Create plan" }).click();

    await page
      .getByPlaceholder("e.g. Jane Smith — 555-0199")
      .fill("Jane Smith — 555-0199");
    await page.selectOption('[name="resuscitation_pref"]', "dnr");

    await page.getByRole("button", { name: "Save plan" }).click();

    // After save the mutation should have been called
    await expect(async () => {
      expect(upsertCalled).toBe(true);
    }).toPass({ timeout: 5000 });
  });
});
