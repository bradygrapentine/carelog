# UI Testing — Vitest Browser Mode + Playwright Write Flows

**Date:** 2026-04-12
**Status:** Approved

## Summary

Two-layer testing expansion:
1. **Vitest Browser Mode** — upgrade existing component tests from jsdom to real Chromium; add interaction-level tests for key components
2. **Playwright write-flow specs** — three new local E2E spec files covering journal entry creation, medication logging, and onboarding

---

## Section 1: Vitest Browser Mode

### Packages

- Add `@vitest/browser` to `apps/web` devDependencies
- Reuse existing `@playwright/test` as the browser provider (already installed)

### Config change (`apps/web/vitest.config.ts`)

Replace:
```ts
environment: "jsdom"
```

With:
```ts
browser: {
  enabled: true,
  provider: "playwright",
  instances: [{ browser: "chromium" }],
},
```

Remove the `environment` key entirely. The `setupFiles` array stays unchanged.

### Setup file updates (`apps/web/vitest.setup.ts`)

Add polyfills for APIs that jsdom stubs but real browsers expose natively:
- `window.matchMedia` mock (for responsive components) — real browser has this, but the current mock may conflict; remove the mock
- `ResizeObserver` — natively available in Chromium; remove any stub

### New component tests

**`apps/web/app/(app)/journal/[recipientId]/__tests__/JournalEntryForm.interaction.test.tsx`**
- Type text into the journal textarea
- Submit the form
- Assert `onSubmit` was called with the typed text
- Assert textarea clears after submit

**`apps/web/components/app/__tests__/AppTabBar.interaction.test.tsx`**
- Click each tab button
- Assert `aria-selected="true"` moves to the clicked tab
- Assert the panel query param changes in the URL (if router is wired in test)

**`apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.interaction.test.tsx`**
- Mount JournalClient with a mock recipient
- Click Medications tab
- Assert medications panel becomes visible and journal panel hides

### Existing test compatibility

All 30+ existing `*.test.tsx` files use `@testing-library/react` + `screen`/`expect` — these APIs are browser-compatible and require no changes. The only expected breakage is tests that import `window.matchMedia` mocks or `ResizeObserver` stubs from `vitest.setup.ts`; those stubs will be removed since real Chromium provides them natively.

### CI integration

In `.github/workflows/ci.yml`, the `web-tests` job already runs `pnpm test`. No job changes needed — Vitest Browser Mode runs in the same command. Playwright must be installed in the CI environment (it already is for the `e2e` job; the `web-tests` job will need `npx playwright install chromium`).

---

## Section 2: Playwright Write-Flow Specs

All three files live under `e2e/` and use the existing `signIn` + `clearMailpit` helpers. They target the **local stack** (`http://localhost:3000` + `supabase start`), not production.

### `e2e/journal-write.spec.ts`

**Setup:** Sign in as `e2e-author@test.com`, navigate to journal.

Tests:
1. **Create entry** — fill textarea with unique text, click Submit, assert entry card with that text appears in timeline (`[data-testid="journal-entry"]`)
2. **Entry persists on reload** — after creating entry, reload page, assert same text still visible in timeline
3. **Flag a reaction** — click reaction button on an entry card, assert reaction count increments

### `e2e/medication-write.spec.ts`

**Setup:** Sign in as `e2e-author@test.com`, navigate to journal, click Medications tab.

Tests:
1. **Add a medication** — click "Add medication", fill name + dosage fields, submit, assert new item appears in medication list
2. **Log a dose** — click the check/log button on a medication, assert item is marked complete (checked state or strikethrough)
3. **Unlog a dose** — click again to uncheck, assert reverts to unchecked

### `e2e/onboarding.spec.ts`

**Setup:** Sign in as a fresh user with no care team (`e2e-new@test.com`, seeded but with no recipient row).

Tests:
1. **No care team → CTA visible** — after sign-in, assert "Set up a care team" link visible on dashboard
2. **Complete onboarding** — click CTA, fill `recipientName` + `orgName`, submit, assert redirected to `/journal/[id]` and journal textarea visible
3. **Onboarding skips for existing team** — sign in as user with existing team, assert no onboarding CTA, "View care journal" button visible instead

### Local Playwright config

The local specs (`auth.spec.ts`, `invite.spec.ts`, etc.) currently rely on a root-level `playwright.config.ts`. Check if it exists: if yes, ensure `testMatch` covers `**/*.spec.ts` broadly (so new files are auto-included). If the file is missing, create it with `baseURL: "http://localhost:3000"`, `testDir: "."`, `testMatch: "**/*.spec.ts"`, excluding `**/*.prod.config.ts` and `setup/**`.

### Test data requirements

- `e2e-author@test.com` — existing user with a care team and at least one journal entry (needed for flag-reaction test)
- `e2e-new@test.com` — user seeded in auth but with no recipient row
- Both users must be seeded in the local Supabase instance via a seed script or migration fixture

---

## Out of scope

- Visual regression / screenshot diffing (no Percy/Chromatic)
- Mobile (Expo) component tests — separate concern
- Storybook catalog
- Prod Playwright config changes (prod tests remain read-only navigation)
