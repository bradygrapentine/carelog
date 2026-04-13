# Wave 6 — Features

Parallel-ready feature plan for the next Carelog wave. Each feature is scoped to non-overlapping files so test-first subagents can execute concurrently.

## Feature 1: Vitest Browser Mode upgrade

**Motivation** Replace jsdom with real Chromium so component interaction tests reflect browser behavior (pulled from 2026-04-12 UI testing spec).

**Scope**
- `apps/web/vitest.config.ts` — swap `environment: "jsdom"` for `browser: { enabled: true, provider: "playwright", instances: [{ browser: "chromium" }] }`
- `apps/web/vitest.setup.ts` — remove `window.matchMedia` and `ResizeObserver` stubs (Chromium provides natively)
- `apps/web/package.json` — add `@vitest/browser` devDependency
- `.github/workflows/ci.yml` — add `npx playwright install chromium` to the `web-tests` job
- New interaction tests:
  - `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalEntryForm.interaction.test.tsx`
  - `apps/web/components/app/__tests__/AppTabBar.interaction.test.tsx`
  - `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.interaction.test.tsx`

**Test strategy** The three new `*.interaction.test.tsx` files go red first (assert typed text submits, `aria-selected` moves on tab click, panel visibility swaps on tab change).

**Acceptance** `pnpm test` runs under Chromium; all three interaction tests green; existing 737 tests stay green.

**Out of scope**
- Visual regression / screenshot diffing
- Mobile (Expo) component tests

---

## Feature 2: Journal write-flow Playwright spec

**Motivation** Production E2E only covers read-only nav. We need local write-flow coverage for journal entries (pulled from 2026-04-12 UI testing spec).

**Scope**
- `e2e/journal-write.spec.ts` — new spec with three tests: create entry, entry persists on reload, flag a reaction
- `e2e/fixtures/seed-e2e-author.sql` — seeds `e2e-author@test.com` with care team + one existing entry
- `playwright.config.ts` (root) — ensure `testMatch: "**/*.spec.ts"` excludes `**/*.prod.config.ts` and `setup/**`

**Test strategy** The three tests in `e2e/journal-write.spec.ts` must fail first (missing `[data-testid="journal-entry"]` selectors, missing reaction-count data attributes). Implementation adds the test IDs.

**Acceptance** `pnpm exec playwright test journal-write` green against local stack.

**Out of scope**
- Prod Playwright config changes
- Medication or onboarding flows (separate features)

---

## Feature 3: Medication write-flow Playwright spec

**Motivation** Cover local E2E for medication catalog add + dose logging (pulled from 2026-04-12 UI testing spec).

**Scope**
- `e2e/medication-write.spec.ts` — three tests: add medication, log a dose, unlog a dose
- `apps/web/components/app/MedicationChecklist.tsx` — add `data-testid="medication-row"` + `data-testid="medication-log-toggle"` if absent
- `apps/web/components/app/MedicationPanel.tsx` — add `data-testid="add-medication"` trigger + form field testids

**Test strategy** `e2e/medication-write.spec.ts` red first — asserts new-medication row appears in list, toggle flips checked state, toggle again reverts.

**Acceptance** `pnpm exec playwright test medication-write` green against local stack.

**Out of scope**
- Prescription OCR scan flow (already shipped)
- Refill alerts

---

## Feature 4: Onboarding write-flow Playwright spec

**Motivation** No E2E currently verifies the fresh-user onboarding CTA → care team creation path (pulled from 2026-04-12 UI testing spec).

**Scope**
- `e2e/onboarding.spec.ts` — three tests: fresh user sees CTA, completes onboarding and lands on journal, existing-team user sees no CTA
- `e2e/fixtures/seed-e2e-new.sql` — seeds `e2e-new@test.com` in auth only (no recipient row)
- `apps/web/app/(app)/dashboard/DashboardClient.tsx` — add `data-testid="setup-care-team-cta"` and `data-testid="view-journal-cta"` if absent

**Test strategy** `e2e/onboarding.spec.ts` red first — asserts CTA visibility toggled by recipient presence and post-submit redirect to `/journal/[id]`.

**Acceptance** `pnpm exec playwright test onboarding` green against local stack.

**Out of scope**
- Invite acceptance flow (covered by existing `invite.spec.ts`)
- Multi-recipient org flows

---

## Feature 5: Stripe billing completion

**Motivation** Last open "before launch" item in BUILD_STATUS.md — checkout/webhook/portal routes exist but the UX loop needs to close so families can actually subscribe.

**Scope**
- `apps/web/app/(app)/billing/page.tsx` — gated subscription state view (active / past_due / canceled), upgrade CTA
- `apps/web/server/routers/billing.ts` — tRPC router (`getSubscription`, `createCheckoutSession`, `createPortalSession`)
- `apps/web/app/api/stripe/webhook/route.ts` — ensure `customer.subscription.*` events upsert into `subscriptions` table
- `supabase/migrations/<timestamp>_subscriptions_table.sql` + matching pgTAP in `supabase/tests/subscriptions_rls.test.sql`
- `apps/web/components/app/BillingStatusBadge.tsx` — header badge when `past_due`

**Test strategy**
- Vitest: `apps/web/server/routers/__tests__/billing.test.ts` red first (mocks Stripe SDK, asserts checkout URL + portal URL returned; webhook upserts subscription)
- pgTAP: `supabase/tests/subscriptions_rls.test.sql` red first (org-members read, service-role-only write)

**Acceptance** Both new test files green; `supabase test db` passes; billing page renders real subscription state.

**Out of scope**
- Annual plan toggle UX polish
- Dunning email templates

---

## Feature 6: Sentry source maps upload

**Motivation** Tech debt callout — Sentry wired with `sendDefaultPii: false` but source maps are pending `SENTRY_AUTH_TOKEN`. Without maps, prod stack traces are unreadable.

**Scope**
- `apps/web/next.config.ts` — add `withSentryConfig` wrapper with `authToken: process.env.SENTRY_AUTH_TOKEN`, `silent: true`, `widenClientFileUpload: true`
- `apps/web/sentry.client.config.ts` / `sentry.server.config.ts` — no code changes; verify release tag uses `process.env.VERCEL_GIT_COMMIT_SHA`
- `.github/workflows/ci.yml` — add `SENTRY_AUTH_TOKEN` secret to deploy job env
- `docs/project-info/runbooks/DEPLOY.md` — update with source-maps verification step
- `apps/web/__tests__/sentry-config.test.ts` — asserts `withSentryConfig` is applied and release tag resolves

**Test strategy** `apps/web/__tests__/sentry-config.test.ts` red first — fails until `next.config.ts` exports a `withSentryConfig`-wrapped config with the correct options.

**Acceptance** Test green; `pnpm build` emits source maps to Sentry (manually verified once in prod); DEPLOY.md updated.

**Out of scope**
- Sentry Replay (intentionally disabled for PHI)
- Custom Sentry breadcrumb filters
