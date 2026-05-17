# Implementation Plan — Live-test tail (TD-166, TD-154, TD-159)

**Date:** 2026-05-17
**Slug:** `live-test-tail-2026-05-17`
**Source rows:** TD-166 (P3), TD-154 (P3), TD-159 (P3)
**Mode:** direct (file-disjoint, 3 tracks)

## Goal

Close three small live-test follow-ups in one wave: a skeleton-state leak on redirect paths, a self-reinforcing OTP error-wording loop, and an unnecessary capability disclosure to non-coordinators.

## Tracks

### Track A — TD-166 · `setLoading(false)` on redirect paths in DashboardClient

**Branch:** `fix/td-166-dashboard-setloading-redirects`
**Files allowed:**
- `apps/web/app/(app)/dashboard/DashboardClient.tsx`
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx` (preferred — router mock already present)
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx` (only if a navigation flow is clearer here)

**Verified state at planning time** (DashboardClient.tsx HEAD `e1e56d7`):
- `pending_invite` bridge: lines 76-85 — `return` at line 80 after `router.push("/invite/" + token)`, no `setLoading(false)` first.
- `pendingPlan` bridge: lines 86-117 — `return` at line 111 inside `if (res.ok)`, no `setLoading(false)` first. Inner try/catch at 89-116 falls through to data fetch if checkout fails; the broken path is the success path.
- TD-165's try/catch/finally at 124-243 covers the data fetch; the redirect bridges sit BEFORE it.

**Work:**
1. Call `setLoading(false)` immediately before each `return` that triggers a navigation:
   - line 79-80 area (pending_invite path): add `setLoading(false);` before `router.push(...); return;`
   - line 110-111 area (pendingPlan path, inside `if (res.ok)`): add `setLoading(false);` before `router.push(url); return;`
2. Keep TD-165's `finally { setLoading(false) }` intact — it still handles the main-data-fetch paths.
3. Verify no double-setLoading hazards by inspection (setting state to its current value is a no-op in React, so duplicate calls are safe).

**Vitest cases (3 new):**
- pending_invite path: when `sessionStorage.pending_invite = "abc"` → router.push is called with `/invite/abc` AND `loading=false` (assert via `.animate-pulse` absence after the navigation effect resolves).
- pendingPlan success path: when `sessionStorage.pendingPlan` is set + checkout response is `ok=true` → router.push called with the checkout URL AND skeleton cleared.
- pendingPlan failure path: when checkout returns non-ok → falls through to the main data fetch (existing behavior preserved); loading clears via TD-165 finally.

**Acceptance:**
- 3 new test cases green; existing 12 dashboard tests still pass (verified: `grep -cE "^\s+it\(" DashboardClient.test.tsx` = 12 at HEAD `e1e56d7`).
- No regression in the `shows loading state initially` test at lines 96-106 (loading must still be true while the IIFE has pending awaits — i.e. setLoading(false) only fires AFTER router.push has been called).
- pendingPlan non-ok response path (already covered by TD-165 `finally`) does not need a new test — the plan is additive on top of TD-165's safety net.

### Track B — TD-154 · OTP error wording

**Branch:** `fix/td-154-otp-error-wording`
**Files allowed:**
- `apps/web/app/signin/SignInForm.tsx`
- `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx`

**Verified state at planning time** (SignInForm.tsx:11-23):
- `friendlyOtpError()` already distinguishes "expired" / "invalid" / "not match" / fallback by string match on the Supabase response message.
- Per backlog row + Cowork live-test report: Supabase `/auth/v1/verify` returns 403 for both wrong-code and expired-code, with a response body that contains the word "expired" in both cases. The frontend's `m.includes("expired")` branch therefore fires for wrong codes too, surfacing "The code expired. Send a new one." — which prompts the user to request a fresh code, invalidating their actually-still-valid current code.

**Work:**
1. Replace the "expired" message in `friendlyOtpError()` with a phrasing that does NOT instruct the user to request a new code. Recommended:
   - Before: `return "The code expired. Send a new one.";`
   - After: `return "That code didn't work. Check the digits or send a new code.";`
2. Update the "invalid"/"not match" branch to match (currently `"That code didn't match. Check the digits or send a new code."` — keep, or align both to a single string). For clarity and to avoid implementer-induced drift, leave the existing "not match" string alone and only change the "expired" branch.
3. Note: this is intentionally backlog option (a) — same wording in both branches, no oracle differentiation. Security-equivalent to the current behavior (still no wrong-vs-expired oracle from the frontend response).

**Vitest cases (2 updated + 1 new):**
- Existing test at line 105 (`screen.getByText("The code expired. Send a new one.")`) updates to the new string.
- Existing mock message `"Token has expired or is invalid"` (or whichever Supabase string fires the "expired" branch) → UI shows new "That code didn't work..." string AND the rendered DOM does NOT contain the word "expired" anywhere user-visible.
- **Additional case** to lock in branch-discrimination: a second mock with message `"OTP has expired"` (truly-expired path) → same UI string. Confirms both wrong-code AND expired-code paths map to the deduplicated copy.

**Code clarity:** also update the inline comment on the `m.includes("expired")` branch to note "fires for both genuinely-expired AND wrong-code responses from Supabase — TD-154 deliberately deduplicated the user-facing copy to avoid the request-fresh-code loop". Prevents next reader from re-introducing the disambiguation.

**Acceptance:**
- 1 **updated** assertion: existing test with mock `"Token has expired or is invalid"` → expect new "That code didn't work..." copy.
- 1 **net-new** case: mock `"OTP has expired"` (truly-expired path) → same new copy.
- Existing SignInForm flow tests pass.
- No code path now displays "The code expired" to the user (grep the rendered DOM).

### Track C — TD-159 · Hide "Export care history" row from non-coordinators

**Branch:** `fix/td-159-coordinator-only-label`
**Files allowed:**
- `apps/web/app/(app)/settings/page.tsx`
- `apps/web/app/(app)/settings/__tests__/page.test.tsx` (create if absent — check first via Glob)

**Verified state at planning time** (settings/page.tsx:566-655):
- `GrowCareSyncSection` already fetches `memberships` filtered by `role=coordinator` (line 590-595). Pattern is replicable.
- The history-export link (lines 638-655) is currently rendered unconditionally in the page body, after `<DangerZoneSection />`. Sub-label says "(coordinators only)" — visible to all users.

**Server-side gating — verified present (no TD-167 needed).** `apps/web/app/(app)/settings/history-export/page.tsx` already queries `memberships` filtered on `role=coordinator` AND `accepted_at IS NOT NULL`, redirecting to `/settings` if empty. The UI gate added here is defense-in-depth / capability-hiding, not the security control.

**Work:**
1. Extract the history-export link into a new **non-exported Server Component function** `HistoryExportLink` defined inside `settings/page.tsx` itself (NOT a separate file — keeps scope tight). Mirror `GrowCareSyncSection`'s server-component pattern (await Supabase directly, no `useEffect`/client fetch). Filter `memberships` on `role=coordinator` AND `accepted_at IS NOT NULL` (matching the server-side gate). Return `null` if zero matching memberships.
2. Mount `<HistoryExportLink />` in place of the inline `<a>` block at lines 638-655.
3. Remove the "(coordinators only)" sub-label from the description text — when non-coordinators don't see the row, the disclosure is gone; when coordinators see it, the role is implicit.

**Vitest cases (2 new):**
- Coordinator user (mock memberships with role=coordinator + accepted_at non-null): `HistoryExportLink` renders, link href is `/settings/history-export`.
- Non-coordinator user (mock memberships with role=caregiver, or accepted_at null, or empty): `HistoryExportLink` renders nothing (returns null).
- Test file may need to be created (settings/page.tsx has no existing colocated test). Check via Glob first; if absent, create `apps/web/app/(app)/settings/__tests__/HistoryExportLink.test.tsx`.

**Acceptance:**
- 2 new test cases green.
- Server-side gate verified at `apps/web/app/(app)/settings/history-export/page.tsx` (cite line in PR description).
- No regression in Settings page render — other sections still mount.

## Risks accepted

- TD-159 changes UI visibility only. The actual export capability is server-side at `/settings/history-export` and `/api/...`. If those routes lack their own role check, the capability is still reachable by a determined user with the URL. Mitigated by Track C step 4 verification.
- TD-154 wording change keeps the existing "no oracle" property. The fix only changes user-facing copy, not response handling.
- TD-166 fix is purely additive — adding `setLoading(false)` before each early return. No behavior change on the happy path.

## Execution order

All 3 tracks independent and file-disjoint. Direct sequential execution (parallel overhead exceeds savings on 3 XS tracks).

## Out of scope

- TD-155 (OTP rate-limiter key audit) — separate row, requires reading Upstash middleware code.
- TD-156 (Supabase email template standardization) — Supabase dashboard config, not code.
- TD-158 (PostgREST schema-suggestion leak) — Supabase Settings → API config check, not code.
- TD-160 (Stripe webhook verify) — manual operator action.
- TD-161 (delete stray Stripe test products) — manual operator action.
