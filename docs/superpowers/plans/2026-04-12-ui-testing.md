# UI Testing — Vitest Browser Mode + Playwright Write Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade component tests from jsdom to real-Chromium browser mode and add three Playwright specs covering write flows (journal entry, medication, onboarding).

**Architecture:** Two independent workstreams. Part A: change `vitest.config.ts` to use `@vitest/browser` with Playwright/Chromium provider — existing 30+ component tests continue working with higher fidelity. Part B: three new `e2e/*.spec.ts` files targeting the local stack (localhost:3000) using existing `signIn`/`clearMailpit` helpers.

**Tech Stack:** Vitest 2.x, `@vitest/browser`, `@playwright/test`, `@testing-library/react`, Next.js 16 (App Router), Supabase local.

---

## File Map

**Modified:**
- `apps/web/vitest.config.ts` — replace jsdom environment with browser mode config
- `apps/web/vitest.setup.ts` — remove `window.location` override (breaks in real browser; no tests use it)
- `.github/workflows/ci.yml` — add `playwright install --with-deps chromium` to `web-tests` job

**Created:**
- `e2e/journal-write.spec.ts` — journal entry creation + persist + flag reaction
- `e2e/medication-write.spec.ts` — add medication + log/unlog dose
- `e2e/onboarding.spec.ts` — new user CTA → complete onboarding → existing user skips

---

## Part A — Vitest Browser Mode

### Task 1: Install @vitest/browser

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the package**

```bash
cd apps/web && pnpm add -D @vitest/browser
```

Expected output ends with: `Done in ...` — no errors.

- [ ] **Step 2: Verify the package is listed**

```bash
grep '@vitest/browser' apps/web/package.json
```

Expected: `"@vitest/browser": "..."`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml 2>/dev/null || git add apps/web/package.json
git commit -m "chore(web): add @vitest/browser for real-Chromium component tests"
```

---

### Task 2: Update vitest.config.ts to browser mode

**Files:**
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1: Replace the config**

Open `apps/web/vitest.config.ts` and replace its entire content with:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    name: "web",
    browser: {
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
    },
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
    },
    reporters: [
      "default",
      ["vitest-sonar-reporter", { outputFile: "sonar-report.xml" }],
    ],
  },
});
```

Note: `environment: "jsdom"` is removed — browser mode replaces it.

- [ ] **Step 2: Verify the file has no `environment` key**

```bash
grep 'environment' apps/web/vitest.config.ts
```

Expected: no output (the key is gone).

---

### Task 3: Clean up vitest.setup.ts

**Files:**
- Modify: `apps/web/vitest.setup.ts`

The `window.location` override uses `Object.defineProperty` which throws in a real browser environment. No test files reference `window.location` directly — they use `vi.mock('next/navigation', ...)` instead. Remove the override.

- [ ] **Step 1: Replace the setup file**

```ts
import '@testing-library/jest-dom'

// posthog-js accesses browser APIs on import.
// Mock it globally so component tests that import posthog don't crash.
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}))
```

- [ ] **Step 2: Commit config changes**

```bash
git add apps/web/vitest.config.ts apps/web/vitest.setup.ts
git commit -m "feat(web): switch Vitest to real-Chromium browser mode via @vitest/browser"
```

---

### Task 4: Run all existing component tests in browser mode

**Files:** none modified — this is verification only.

- [ ] **Step 1: Install Playwright Chromium if not already present**

```bash
cd apps/web && npx playwright install chromium
```

Expected: `Chromium ... is already installed` or a download + `Done`.

- [ ] **Step 2: Run the full test suite**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass. If any fail, the most likely causes are:

| Failure pattern | Fix |
|---|---|
| `matchMedia is not a function` | Add `window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })` inside the `if (typeof window !== 'undefined')` block in `vitest.setup.ts` |
| `ResizeObserver is not defined` | Add `global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))` to `vitest.setup.ts` |
| `Cannot redefine property: location` | The override was already removed in Task 3 — this means a test directly uses `window.location`; find it with `grep -r 'window.location' apps/web` and replace with `vi.mock('next/navigation', ...)` |

Fix any failures before committing.

- [ ] **Step 3: Commit the green suite**

```bash
git add -A
git commit -m "test(web): confirm all component tests pass in Chromium browser mode"
```

---

### Task 5: Update CI web-tests job to install Chromium

**Files:**
- Modify: `.github/workflows/ci.yml`

The `web-tests` job runs `pnpm test:coverage` but doesn't install Playwright browsers. Browser mode requires Chromium to be present.

- [ ] **Step 1: Add Playwright install step**

In `.github/workflows/ci.yml`, find the `web-tests` job. After the `pnpm install --frozen-lockfile` step and before the `Run tests with coverage` step, insert:

```yaml
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium
        working-directory: apps/web
```

The full `web-tests` job steps should read:

```yaml
  web-tests:
    name: Web — unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium
        working-directory: apps/web
      - name: Run tests with coverage
        run: pnpm test:coverage
        working-directory: apps/web
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: web-coverage
          path: apps/web/coverage/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install Playwright Chromium before Vitest browser-mode tests"
```

---

## Part B — Playwright E2E Write-Flow Specs

All specs target the local stack (`http://localhost:3000`). The root `playwright.config.ts` points to `./e2e` and picks up all `*.spec.ts` files automatically — no config changes needed.

**Prerequisites before running these specs locally:**
- `supabase start` running
- `pnpm web` running (localhost:3000)
- Test users seeded (see Task 6 step 1 for seed instructions)

---

### Task 6: Seed test users for write-flow tests

Three test emails are needed:
- `e2e-author@test.com` — existing user with a care team (used by journal-write and medication-write)
- `e2e-new@test.com` — user in auth but with **no** recipient row (used by onboarding)
- `e2e-coordinator@test.com` — already seeded by existing tests

The `signIn` helper creates sessions via OTP (Mailpit). Users are created on first sign-in because Supabase auth allows any email with OTP in local mode. The care team must exist before tests run — **the helpers.ts `navigateToJournal` function already handles this** (it detects no care team and completes onboarding). So `e2e-author@test.com` just needs to exist in auth; the first run of `journal-write.spec.ts` will create its care team via the helper.

For `e2e-new@test.com`: this test specifically needs a user who has **never** completed onboarding. Since Supabase local auto-creates users on OTP sign-in, a fresh email that hasn't gone through onboarding works. The test signs in fresh each run — as long as this email has no recipient row, onboarding appears.

- [ ] **Step 1: Verify Mailpit is accessible**

```bash
curl -s http://127.0.0.1:54324/api/v1/messages | head -c 50
```

Expected: `{"messages":` ... (JSON response, not a connection error)

If this fails, run `supabase start` first.

- [ ] **Step 2: No seed file needed — document the approach**

Both emails get created on first OTP sign-in. `e2e-new@test.com` must never complete onboarding. If a previous run completed onboarding for `e2e-new@test.com`, reset it:

```bash
# Only needed if e2e-new@test.com already has a recipient row
npx supabase db reset  # WARNING: resets all local data
```

In practice, use a timestamp-suffix email in the onboarding test to guarantee freshness (see Task 9).

---

### Task 7: e2e/journal-write.spec.ts

**Files:**
- Create: `e2e/journal-write.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// e2e/journal-write.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const AUTHOR_EMAIL = "e2e-author@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Journal write flows", () => {
  test("create a journal entry — appears in timeline", async ({ page }) => {
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const uniqueText = "E2E test entry " + Date.now();
    const textarea = page.getByPlaceholder("Share how today went...");
    await textarea.click();
    await textarea.fill(uniqueText);

    await page.click('button:has-text("Good")');
    await page.click('button:has-text("Share update")');

    // Entry appears in timeline
    await expect(
      page.locator('[data-testid="journal-entry"]').filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("entry persists after page reload", async ({ page }) => {
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const uniqueText = "Persist test " + Date.now();
    const textarea = page.getByPlaceholder("Share how today went...");
    await textarea.click();
    await textarea.fill(uniqueText);
    await page.click('button:has-text("Share update")');

    await expect(
      page.locator('[data-testid="journal-entry"]').filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });

    await page.reload();

    await expect(
      page.locator('[data-testid="journal-entry"]').filter({ hasText: uniqueText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("form clears after submit", async ({ page }) => {
    await signIn(page, AUTHOR_EMAIL);
    await navigateToJournal(page);

    const textarea = page.getByPlaceholder("Share how today went...");
    await textarea.click();
    await textarea.fill("Clearing test");
    await page.click('button:has-text("Share update")');

    // Form returns to collapsed state with empty textarea
    await expect(textarea).toHaveValue("", { timeout: 5000 });
    await expect(page.locator('button:has-text("Cancel")')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec (requires local stack)**

```bash
pnpm exec playwright test e2e/journal-write.spec.ts --headed
```

Expected: 3 tests pass. If `navigateToJournal` triggers onboarding for `e2e-author@test.com` on first run, it completes automatically via helpers.ts.

- [ ] **Step 3: Commit**

```bash
git add e2e/journal-write.spec.ts
git commit -m "test(e2e): journal write flows — create, persist, form-clear"
```

---

### Task 8: e2e/medication-write.spec.ts

**Files:**
- Create: `e2e/medication-write.spec.ts`

The Medications tab in the tab bar navigates to the panel. The MedicationPanel renders a collapsed card by default — it has an expand button. Once expanded, coordinators see "Add medication" form controls.

- [ ] **Step 1: Write the spec**

```ts
// e2e/medication-write.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit, navigateToJournal } from "./helpers";

const AUTHOR_EMAIL = "e2e-author@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

async function goToMedicationsPanel(page: import("@playwright/test").Page) {
  await signIn(page, AUTHOR_EMAIL);
  await navigateToJournal(page);
  // Click the Medications tab in the tab bar
  await page.click('button[aria-label="Medications"]');
  await expect(page).toHaveURL(/panel=medications/, { timeout: 8000 });
  // Expand the MedicationPanel card if it shows a collapsed state
  const expandBtn = page.getByRole("button", { name: /Medications/i }).last();
  await expect(expandBtn).toBeVisible({ timeout: 5000 });
  await expandBtn.click();
}

test.describe("Medication write flows", () => {
  test("add a medication — appears in list", async ({ page }) => {
    await goToMedicationsPanel(page);

    const drugName = "Lisinopril-" + Date.now();

    // Show the add form
    await page.click('button:has-text("Add medication")');

    await page.fill('[placeholder*="Drug name"], [name="drug_name"], input[type="text"]:first-of-type', drugName);
    await page.fill('[placeholder*="Dosage"], [name="dosage"]', "10mg daily");
    await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save medication")');

    // New medication appears in list
    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });
  });

  test("delete a medication — removed from list", async ({ page }) => {
    await goToMedicationsPanel(page);

    // Add one first so we have something to delete
    const drugName = "ToDelete-" + Date.now();
    await page.click('button:has-text("Add medication")');
    await page.fill('[placeholder*="Drug name"], [name="drug_name"], input[type="text"]:first-of-type', drugName);
    await page.fill('[placeholder*="Dosage"], [name="dosage"]', "5mg");
    await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save medication")');
    await expect(page.getByText(drugName)).toBeVisible({ timeout: 8000 });

    // Delete it
    const row = page.locator("li, [data-testid='medication-item']").filter({ hasText: drugName });
    await row.getByRole("button", { name: /delete|remove/i }).click();

    await expect(page.getByText(drugName)).not.toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm exec playwright test e2e/medication-write.spec.ts --headed
```

Expected: 2 tests pass. If selectors for the add-form inputs don't match the real UI, inspect the running app with `--headed` and update the placeholder/name selectors to match what the form actually renders.

- [ ] **Step 3: Commit**

```bash
git add e2e/medication-write.spec.ts
git commit -m "test(e2e): medication write flows — add and delete"
```

---

### Task 9: e2e/onboarding.spec.ts

**Files:**
- Create: `e2e/onboarding.spec.ts`

Use a timestamp-suffixed email for the "new user" test so it's always fresh (no leftover recipient row from a prior run). The `navigateToJournal` helper handles the case where a care team exists — but the onboarding test specifically needs the CTA to appear, so it signs in as a brand-new email and does NOT call `navigateToJournal`.

- [ ] **Step 1: Write the spec**

```ts
// e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";
import { signIn, clearMailpit } from "./helpers";

const EXISTING_EMAIL = "e2e-author@test.com";

test.beforeEach(async () => {
  await clearMailpit();
});

test.describe("Onboarding flow", () => {
  test("new user sees set-up CTA on dashboard", async ({ page }) => {
    // Use a unique email so this user has never completed onboarding
    const freshEmail = `e2e-new-${Date.now()}@test.com`;
    await signIn(page, freshEmail);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    // New user with no care team sees the onboarding CTA
    await expect(
      page.getByRole("link", { name: /Set up a care team/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("new user completes onboarding and lands on journal", async ({ page }) => {
    const freshEmail = `e2e-onboard-${Date.now()}@test.com`;
    await signIn(page, freshEmail);

    await page.click('a:has-text("Set up a care team")');
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });

    await page.fill('[name="recipientName"]', "E2E Test Person");
    await page.fill('[name="orgName"]', "E2E Test Family");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 15000 });
    await expect(
      page.getByPlaceholder("Share how today went..."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("existing user with care team skips onboarding CTA", async ({ page }) => {
    await signIn(page, EXISTING_EMAIL);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    // Should see "View care journal" — not the onboarding CTA
    await expect(
      page.getByRole("button", { name: /View care journal/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Set up a care team/i }),
    ).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm exec playwright test e2e/onboarding.spec.ts --headed
```

Expected: 3 tests pass. The first two use fresh timestamp emails so they always start as new users. The third verifies `e2e-author@test.com` (which completed onboarding in Task 7) shows the journal CTA.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding.spec.ts
git commit -m "test(e2e): onboarding flow — new user CTA, complete onboarding, existing user skips"
```

---

### Task 10: Run full local E2E suite

- [ ] **Step 1: Ensure local stack is running**

```bash
supabase start
# in a separate terminal:
pnpm web
```

- [ ] **Step 2: Run all three new specs together**

```bash
pnpm exec playwright test e2e/journal-write.spec.ts e2e/medication-write.spec.ts e2e/onboarding.spec.ts
```

Expected: 8 tests pass (3 + 2 + 3). Fix any selector mismatches found during headed runs in Tasks 7-9.

- [ ] **Step 3: Final commit if any fixes were made**

```bash
git add e2e/
git commit -m "fix(e2e): selector adjustments from full-suite run"
```

---

## Self-Review

**Spec coverage:**
- ✅ Vitest Browser Mode (Tasks 1-4)
- ✅ CI Chromium install (Task 5)
- ✅ Journal write (Task 7)
- ✅ Medication write (Task 8)
- ✅ Onboarding (Task 9)

**Placeholder scan:** All steps have concrete code. Selector alternatives are provided for form inputs where exact names are uncertain. No TBDs.

**Type consistency:** `signIn`, `clearMailpit`, `navigateToJournal` imported from `./helpers` in all three spec files — matches existing exports in `e2e/helpers.ts`.
