# Overnight Backlog

Stories in this file are picked up by the nightly development agent (runs 2am Chicago / 8am UTC).

## Format rules
- Mark completed stories `✅ DONE` — the agent skips them
- List prerequisites in `**Blocked by:**` — agent skips blocked stories
- One story per `###` heading with a unique ID (e.g. `P4-01`)

## Sequencing Overview

```
ON-01 BUILD_STATUS housekeeping  ─── no deps, run first (5 min)
ON-02 Auth E2E regression test   ─── no deps, validates proxy.ts fix
ON-03 Billing E2E                ─── no deps
ON-04 Phase 4-5 E2E coverage     ─── no deps, largest story, fan-out
ON-05 Phase 2 shifts E2E         ─── no deps
ON-06 Mobile token compliance    ─── no deps, quick cleanup
ON-07 push_tokens pgTAP test     ─── no deps, RLS coverage gap
ON-08 Dead code removal          ─── no deps, quick cleanup
ON-09 SignInForm loading bug     ─── no deps, one-line fix + test
```

All stories are independent — agent may run ON-02 through ON-09 in parallel.

---

## Stories

---

### ON-01 — BUILD_STATUS.md housekeeping ✅ DONE 2026-04-13

**What:** Mark the two completed items that are currently unchecked.

**Files to change:**
- `docs/project-info/product/BUILD_STATUS.md`
  - Check `[ ] Stripe billing` — routes, webhook, billing page, and tests are all done (sonar-report.xml confirms 28 passing test cases)
  - Add a line under "Before launch" or "Infrastructure": `[x] Proxy (Next.js 16 middleware) — session refresh wired; OTP→dashboard redirect fixed 2026-04-13`

**Acceptance criteria:**
- [ ] Stripe checkbox is `[x]`
- [ ] Proxy/auth fix is documented in BUILD_STATUS.md

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-02 — Auth proxy regression E2E test ✅ DONE 2026-04-13 — `e2e/auth-proxy.spec.ts`

**Context:** `apps/web/proxy.ts` was a no-op (`return NextResponse.next()`). It was fixed today (2026-04-13) to call `supabase.auth.getUser()` and propagate refreshed session cookies. Without this fix, OTP sign-in succeeded client-side but `(app)/layout.tsx` could not see the session server-side, causing an immediate redirect back to `/signin`.

**What:** Write a Playwright E2E test that exercises the full OTP sign-in flow so this regression can never ship silently again.

**Technical details:**
- The existing `e2e/auth.spec.ts` has a sign-in test but may not assert that the user lands on `/dashboard`
- Read `e2e/auth.spec.ts` first — extend it or write a separate `e2e/auth-proxy.spec.ts`
- Use Supabase test user / Mailpit OTP approach already established in the E2E suite
- Assert: after OTP confirm, `page.url()` contains `/dashboard` (not `/signin`)
- Assert: no redirect loop (URL does not momentarily visit `/signin` then redirect away)

**Files to change:**
- `e2e/auth-proxy.spec.ts` — new spec (or extend `e2e/auth.spec.ts` with a redirect assertion)
- Read `e2e/CLAUDE.md` and existing auth spec before writing — follow established patterns

**Acceptance criteria:**
- [ ] Test signs in with valid OTP and asserts final URL is `/dashboard`
- [ ] Test fails if proxy is reverted to the no-op version (verified by code inspection)
- [ ] `pnpm exec playwright test e2e/auth-proxy.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-03 — Billing E2E test ✅ DONE 2026-04-13 — `e2e/billing.spec.ts` + `billing-success.spec.ts`

**Context:** Stripe routes are fully implemented (checkout, portal, webhook, verify — 28 unit tests in sonar-report.xml) but there are no Playwright E2E tests for the billing page or Stripe checkout flow.

**Technical details:**
- Read `apps/web/app/(app)/billing/BillingClient.tsx` and `billing/page.tsx` before writing
- Coordinator navigates to `/billing` — sees Free Plan with upgrade buttons
- Mock the Stripe checkout API call (intercept `/api/stripe/checkout` in Playwright, return `{ url: 'https://checkout.stripe.com/test' }`)
- Assert the billing page renders for coordinators
- Assert non-coordinators see "Contact your coordinator to manage billing"
- Test the billing `/success` page redirect: visit `/billing/success?session_id=cs_test_xxx` and assert it renders without 500
- Read `apps/web/app/(app)/billing/success/page.tsx` to understand what it expects

**Files to change:**
- `e2e/billing.spec.ts` — new

**Acceptance criteria:**
- [ ] Coordinator sees billing page with upgrade buttons
- [ ] Supporter/caregiver sees "Contact your coordinator" message
- [ ] Clicking upgrade calls `/api/stripe/checkout` (verified via route.fulfill intercept)
- [ ] `pnpm exec playwright test e2e/billing.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-04 — E2E coverage for Phase 4–5 features ✅ DONE 2026-04-13 — expenses, outer-circle, care-brief, benefits, eol-planner, export all shipped

**Context:** The following features shipped in Phases 4–5 but have NO Playwright E2E tests. Each has full unit test coverage but no integration-level browser test.

| Feature | Web route | Has E2E? |
|---------|-----------|----------|
| Expenses | journal page → expense panel | ❌ |
| Outer circle (volunteer board) | `/care/[token]` public page | ❌ |
| Care brief | `/brief/[token]` public page | ❌ |
| Benefits navigator | journal page → benefits panel | ❌ |
| EOL planner | journal page → eol planner panel | ❌ |
| History export | journal page → export button | ❌ |

**Instructions:**
1. Read the existing Phase 4-5 component files before writing tests
2. Follow the established E2E pattern in `e2e/documents.spec.ts` and `e2e/burnout.spec.ts` as templates
3. Read `e2e/CLAUDE.md` for test helpers and auth setup patterns
4. Write one spec file per feature — do not bundle unrelated features into one file
5. Public pages (`/care/[token]`, `/brief/[token]`) should be tested without auth (Playwright no-auth context)
6. Coordinator-only features: assert non-coordinators cannot see the form/button

**Files to create:**
- `e2e/expenses.spec.ts`
- `e2e/outer-circle.spec.ts` — tests the public `/care/[token]` page claim flow
- `e2e/care-brief.spec.ts` — tests the public `/brief/[token]` render + revoke
- `e2e/benefits.spec.ts`
- `e2e/eol-planner.spec.ts`
- `e2e/export.spec.ts` — test coordinator can initiate export, assert download headers

**Acceptance criteria:**
- [ ] Each spec file has at minimum: happy-path test + role-enforcement test
- [ ] Public page specs run without auth
- [ ] `pnpm exec playwright test e2e/expenses.spec.ts` passes (and similarly for each)
- [ ] No test uses hardcoded UUIDs — use test fixtures / data created in beforeEach

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-05 — E2E tests for Phase 2 scheduler (shifts) ✅ DONE 2026-04-13 — `e2e/shifts.spec.ts` + `e2e/coverage-settings.spec.ts`

**Context:** Shifts, coverage windows, and gap detection shipped in Phase 2 but have no Playwright E2E tests. The gap detector runs as an Inngest cron; only the UI-facing shift creation and display need E2E coverage.

**Technical details:**
- Read `apps/web/app/journal/[recipientId]/ShiftForm.tsx` and `ShiftList.tsx` before writing
- Coordinator creates a shift → assert it appears in ShiftList
- Caregiver sees their shift highlighted with "Your shift" label
- Coordinator can cancel a shift → status badge updates
- Coverage settings: coordinator adds a coverage window → appears in list

**Files to create:**
- `e2e/shifts.spec.ts`
- `e2e/coverage-settings.spec.ts`

**Acceptance criteria:**
- [ ] Coordinator creates shift, shift appears in list with correct status badge
- [ ] Non-coordinator cannot see the ShiftForm
- [ ] Cancel flow: shift status changes to "cancelled" in ShiftList
- [ ] `pnpm exec playwright test e2e/shifts.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-06 — Mobile design token compliance: More screen + tab navigator

**Context:** Two mobile files use raw hex colors instead of the design token system. Per `apps/mobile/CLAUDE.md`: "Never use raw hex in screen files — always import from tokens."

**Files with violations:**

1. `apps/mobile/app/(app)/more/index.tsx` — uses inline `StyleSheet.create` with hardcoded hex:
   - `backgroundColor: "#fff"` → `colors.surface` (or equivalent from tokens.ts)
   - `color: "#111827"` (heading and label) → `colors.ink`
   - `backgroundColor: "#f9fafb"` (card) → `colors.surfaceSubtle` or similar
   - `borderColor: "#e5e7eb"` (card border) → `colors.border`
   - Also uses emoji icons — check if the token system has icon conventions

2. `apps/mobile/app/(app)/_layout.tsx` — uses `tabBarActiveTintColor: "#0369a1"` — replace with token value

**Instructions:**
1. Read `apps/mobile/constants/tokens.ts` first to find the correct token names
2. In `more/index.tsx`: replace raw hex with token imports; preserve all layout logic
3. In `_layout.tsx`: replace the hex tint color with the correct primary token
4. Run `pnpm typecheck` to confirm no type errors introduced
5. Do NOT change any functionality, navigation, or component structure

**Acceptance criteria:**
- [ ] No raw hex strings in `more/index.tsx` or `_layout.tsx`
- [ ] All colors reference named tokens from `constants/tokens.ts`
- [ ] `pnpm typecheck` passes
- [ ] Existing mobile Jest tests still pass: `cd apps/mobile && pnpm test`

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-07 — pgTAP RLS test for push_tokens ✅ DONE 2026-04-13 — `supabase/tests/push_tokens_rls.test.sql` (5 tests)

**Context:** `supabase/migrations/20260415000000_push_tokens.sql` creates the `push_tokens` table with an "owner-only" RLS policy. There is no `supabase/tests/push_tokens_rls.test.sql` — this policy has never been tested.

**Instructions:**
- Read the migration file to understand the exact policy definition
- Follow the pattern in `supabase/tests/expenses_rls.test.sql` (simplest existing example)
- Read `supabase/CLAUDE.md` for pgTAP conventions before writing

**Cases to cover:**
1. Owner can insert their own token (passes)
2. Owner can select their own tokens (passes)
3. Another user cannot select someone else's tokens (blocked)
4. Another user cannot insert a token for a different user_id (blocked)
5. Unauthenticated request is blocked

**Files to create:**
- `supabase/tests/push_tokens_rls.test.sql`

**Acceptance criteria:**
- [ ] `supabase test db` passes with new file included
- [ ] Uses 4-arg `throws_ok` form (not 2-arg) per pgTAP conventions
- [ ] File follows existing naming and header conventions

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-08 — Dead code removal: unused auth files ✅ DONE

(Completed 2026-04-13 during @supabase/ssr upgrade — both files deleted.)

**Context:** Two files are never imported or called from anywhere:

1. `apps/web/app/signin/actions.ts` — exports `verifyOtpAction` (Server Action). `SignInForm.tsx` calls `supabase.auth.verifyOtp()` directly on the browser client; this server action is dead.

2. `apps/web/app/auth/callback/route.ts` — a POST route handler that also verifies OTP. Not linked from the sign-in form or any other file; duplicates `apps/web/app/api/auth/verify/route.ts`.

**Instructions:**
1. Grep `apps/web` for any import of `verifyOtpAction` and any reference to `auth/callback` to confirm they are unreferenced
2. Only delete if confirmed unused
3. Delete confirmed dead files
4. Run `pnpm typecheck` and `pnpm test`

**Files to delete (after confirming unused):**
- `apps/web/app/signin/actions.ts`
- `apps/web/app/auth/callback/route.ts`

**Acceptance criteria:**
- [ ] Both files deleted (or a comment explaining why one was kept)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-09 — Fix SignInForm loading state stuck on success (TDD) ✅ DONE 2026-04-13 — `setLoading(false)` before `router.replace` + TDD test

**Context:** `apps/web/app/signin/SignInForm.tsx` `handleVerifyOtp` never calls `setLoading(false)` on the happy path. If `router.replace("/dashboard")` is delayed or fails, the submit button is stuck on "Signing you in…" with no way to retry.

**TDD approach — write the failing test first:**

```ts
// assert button returns to "Sign in" after verifyOtp resolves
// even when router.replace is mocked to do nothing
```

**Fix (one line, after the test is written):**
```ts
// apps/web/app/signin/SignInForm.tsx — before router.replace:
setLoading(false);
router.replace("/dashboard");
```

**Files to change:**
- `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx` — add failing test first
- `apps/web/app/signin/SignInForm.tsx` — add `setLoading(false)` before `router.replace`

**Acceptance criteria:**
- [ ] Failing test written before the fix (TDD order enforced)
- [ ] Test mocks `router.replace` to a no-op and asserts button label returns to "Sign in"
- [ ] `pnpm test` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-10 — Full-text search across document vault contents ✅ DONE 2026-04-13 — tsvector column + GIN index, Inngest `documentsExtractText`, server-side `q` param with debounced input, snippet rendering, pgTAP for org-scoped FTS

**Context:** The document vault only supports substring search on `display_name`. Users need to find documents by their *contents* — e.g. "find the POA that mentions Dr. Chen". Requires OCR/text extraction and a Postgres FTS index.

**Technical details:**
- Add `documents.extracted_text text` column (nullable) + `documents.extracted_text_tsv tsvector` generated column + GIN index on the tsvector
- On `POST /api/documents/upload`, after successful storage write, enqueue an Inngest job `documents/extract-text` analogous to the existing `ocr/job.created` pattern
- The Inngest handler calls the same OCR pipeline used for prescription labels (or a PDF-to-text library for `application/pdf`) and writes the extracted text back
- Extend `trpc.documents.list` to accept an optional `q` param; when present, use `websearch_to_tsquery` against `extracted_text_tsv` (fall back to `display_name ILIKE` when the tsvector column is null for that row)
- UI: extend the existing `DocumentVault` search input to search both name AND contents; show a small "matched in content" snippet when the match is body-only

**Acceptance criteria:**
- [ ] Existing documents get backfilled (admin script or automatic on next access)
- [ ] New uploads have text extracted within 60s
- [ ] Search input filters by name OR content, client sees a snippet for content matches
- [ ] pgTAP test confirms FTS query returns only org-scoped rows (RLS respected)

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~1 day

---

### ON-11 — Mobile Panel component migration across screens

**Context:** `apps/mobile/components/Panel.tsx` was added to mirror the web's light-purple tinted-header panel pattern (violet `primarySubtle` strip + divider + card body). Most mobile screens still render ad-hoc `<View>` cards inline with `StyleSheet.create` and bespoke headers. Migrating those to the shared `Panel` component will give the mobile app visual parity with the web, reduce code duplication, and let us iterate the panel style in one place.

**Technical details:**
- Replace ad-hoc card headers in: `journal/index.tsx`, `medications/index.tsx`, `schedule/index.tsx`, `team/index.tsx`, `symptoms/index.tsx`, `burnout/index.tsx`, `expenses/index.tsx`, `documents/index.tsx`, `outer-circle/index.tsx`, `care-brief/index.tsx`, `benefits/index.tsx`, `eol-planner/index.tsx`
- Each panel takes a title + optional right-aligned action node (usually a "+ Add" or filter button)
- Body renders as `children`; internal layout stays per-screen
- Component at `apps/mobile/components/Panel.tsx` — already implements header + divider + card styles from `constants/tokens.ts`

**Acceptance criteria:**
- [ ] Every screen listed above renders a `<Panel>` for its primary content group
- [ ] No visual regression on iOS 17+ and Android 13+ (spot-check a few screens)
- [ ] Mobile Jest suite remains green

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~0.5 day

---

### ON-12 — Mobile: load Inter font (claimed in CLAUDE.md, not actually wired)

**Context:** `apps/mobile/CLAUDE.md` says "Font: Inter (loaded via @expo-google-fonts/inter + expo-font at root layout)". The reality:
- `@expo-google-fonts/inter` is NOT in `apps/mobile/package.json`
- No `useFonts` or font-loading call exists in `apps/mobile/app/_layout.tsx`
- The app renders in the system default (San Francisco on iOS, Roboto on Android), not Inter

Result: mobile typography diverges from web (which uses Geist via `--font-sans`).

**Technical details:**
- `pnpm add @expo-google-fonts/inter expo-font expo-splash-screen --filter mobile`
- In `apps/mobile/app/_layout.tsx`, call `useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })` and return `null` (or a splash) until fonts are ready
- Set `fontFamily: 'Inter_400Regular'` as default on `Text` via a ThemeProvider or a custom `AppText` component
- Add a top-level `styles` entry in `constants/tokens.ts` for `fontFamily.regular` / `fontFamily.semibold` / `fontFamily.bold` and consume from there
- Update CLAUDE.md to match actual behavior once shipped

**Acceptance criteria:**
- [ ] Inter renders on a physical iOS device + Android emulator after a cold start
- [ ] No flash of system font before Inter loads (splash or null-return handles it)
- [ ] Existing tests still pass (fonts should not affect Jest snapshots)

**Blocked by:** nothing
**Blocks:** ON-11 (visual parity hurts until both ship)
**Size:** ~2 hours

---

### ON-13 — Mobile: dark mode support

**Context:** The web app is light-only today but the violet/plum palette works for both modes. The mobile app is also light-only. iOS 17+ and Android 13+ users who set their system theme to dark see a jarring bright-white app — especially at night when caregivers are most likely to pick up the phone to log a 3am medication.

**Technical details:**
- Extend `constants/tokens.ts` with a `darkColors` object mirroring the light palette (inverted surfaces, brightened text, reduced border contrast)
- Add a `useColorScheme` wrapper (from `react-native`) in a `useTokens()` hook that returns the active palette
- Thread tokens through via a light React context OR via an `AppText` / `AppView` wrapper that subscribes to the hook
- Update `Panel` + screen `StyleSheet.create` calls to consume `useTokens()` instead of the static `colors` export (or keep both and pick at render time)
- Respect the `expo-status-bar` style so the status bar flips with the theme

**Acceptance criteria:**
- [ ] Toggling system dark mode mid-session updates the app without a reload
- [ ] All surfaces legible at both schemes (visually verify contrast)
- [ ] No test regressions; snapshot tests either updated or parameterised

**Blocked by:** ON-11 (Panel component must be in widespread use first — otherwise ad-hoc screens will go un-theme'd)
**Blocks:** nothing
**Size:** ~1 day

---

### ON-14 — Mobile: haptic feedback on key actions

**Context:** Native apps feel significantly more polished with subtle haptics on primary actions (logging a med, submitting a journal entry, flagging an entry for doctor, claiming a volunteer slot). Currently none of these trigger any haptic.

**Technical details:**
- `pnpm add expo-haptics --filter mobile`
- Wrap key action handlers with `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` before the async mutation fires, or `notificationAsync(NotificationFeedbackType.Success)` on success
- Candidates: medication "Mark as given", journal entry submit, flag-for-doctor toggle, shift scheduling, volunteer slot claim
- Guard calls with `if (Platform.OS !== 'web')` since `expo-haptics` no-ops on web but imports can still bloat web bundle — keep the mobile screens web-safe if they run under `react-native-web`
- Do NOT fire haptics on every tap — only on meaningful mutations

**Acceptance criteria:**
- [ ] At least 5 meaningful actions trigger haptics on a physical iPhone
- [ ] No haptic on passive interactions (scroll, open menu, navigation)
- [ ] Tests still pass (mock expo-haptics module)

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~3 hours

---

### ON-16 — Mobile: migrate screens to `useAppTheme()`

**Context:** ON-13 established the dark mode foundation (`darkColors`, `useAppTheme()` hook, Panel). Every screen that still imports `colors` directly from `constants/tokens` needs to be converted to `useAppTheme()` + a `useMemo`'d stylesheet so it reacts to system theme changes.

**Technical details:**
- Swap `import { colors } from '../../constants/tokens'` for `const { colors } = useAppTheme()` in each screen
- Replace top-level `StyleSheet.create({ ... colors.X ... })` calls with a `useMemo(() => StyleSheet.create(...), [colors])` inside the component
- Do NOT change any layout logic, navigation, or component structure — only the color binding
- Start with the screens migrated to `<Panel>` in ON-11; they share a common pattern

**Files to change (do NOT change until ON-11 is merged):**
- `app/(app)/journal/index.tsx`
- `app/(app)/medications/index.tsx`
- `app/(app)/schedule/index.tsx`
- `app/(app)/team/index.tsx`
- `app/(app)/symptoms/index.tsx`
- `app/(app)/burnout/index.tsx`
- `app/(app)/expenses/index.tsx`
- `app/(app)/documents/index.tsx`
- `app/(app)/outer-circle/index.tsx`
- `app/(app)/care-brief/index.tsx`
- `app/(app)/benefits/index.tsx`
- `app/(app)/eol-planner/index.tsx`
- `app/(app)/more/index.tsx`
- `app/(app)/settings/index.tsx`
- Any other screen files importing `colors` directly

**Acceptance criteria:**
- [ ] No screen imports `colors` directly from `constants/tokens` — all consume `useAppTheme()`
- [ ] Toggling system dark mode mid-session updates all screens without a reload
- [ ] `cd apps/mobile && pnpm test` passes (214/214)
- [ ] `pnpm exec tsc --noEmit` zero new errors

**Blocked by:** ON-11 (Panel migration must land first), ON-13 (dark palette foundation)
**Blocks:** nothing
**Size:** ~0.5 day

---

### ON-15 — Mobile: accessibility audit against iOS Dynamic Type + screen reader

**Context:** Mobile uses fixed `fontSize` values throughout and isn't tested against iOS Dynamic Type (users who set their system text to "Larger Accessibility Sizes"). Also no verification that VoiceOver / TalkBack announce controls in a sensible order.

**Technical details:**
- Run the app under iOS Dynamic Type (Settings → Accessibility → Display & Text Size → Larger Text → max setting) on a physical device. Log every truncated / overlapping / illegible surface.
- For each `fontSize: N`, migrate to scaling: use `PixelRatio.getFontScale()` or add a `scaledSize()` helper that multiplies by the scale factor capped at 1.5x.
- Run with VoiceOver (iOS) and TalkBack (Android): verify every TouchableOpacity has an `accessibilityLabel`, focus order is sensible, headings announce with `accessibilityRole="header"`.
- Fix the highest-impact 3–5 issues in this ticket; create follow-ups for the rest.

**Acceptance criteria:**
- [ ] App is usable at 200% Dynamic Type without truncation on key screens (journal, medications, schedule)
- [ ] VoiceOver can complete a medication log flow end-to-end without sighted help
- [ ] Report of remaining issues added back to backlog as ON-XX follow-ups

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~1 day
