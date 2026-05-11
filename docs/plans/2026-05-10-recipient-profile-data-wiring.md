# Recipient profile — wire data into the 3 scaffolded panels

**Date:** 2026-05-10
**Base SHA:** c40a50f1697cef3c52e213bdd3b7fcbc43ef4d03
**Source backlog:** UX-103, UX-104, UX-105
**PRD:** n/a
**Recommended executor:** /sprint (currently mid-pipeline) → /wave at Step 7

## Goal

The recipient profile route (`apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx`) already mounts three component shells with empty/static props. Wire each to real data via tRPC — no new tables required (existing `care_recipients.preferences` jsonb covers UX-104; existing `identity_vault.contact_info` jsonb covers UX-105 within PHI-isolated storage).

## Non-goals

- New DB tables. Both jsonb columns exist; do NOT add `recipient_preferences` / `emergency_info` tables.
- PHI surface for emergency contact names — `contact_info` is keyed off `identity_token`; access must go through the identity vault read path, not bare care_recipients joins.
- Edit forms beyond the read-and-display wiring. Edit affordance is part of the rows but is split out so this chunk lands as 3 small PRs not 3 fat ones. File a follow-up `UX-103b/104b/105b` if edit affordance still isn't shipped after this wave.
- Mobile parity (PP-009 territory).
- `display_names` cache invalidation logic — read-only consumption only.

## Tracks

### Track 1 — UX-103 — wire CareTeamList to memberships

**Sources backlog UX-103.**

**FILES ALLOWED** (modify/create):
- `apps/web/server/routers/memberships.ts` — add `listForRecipient(orgId, recipientId)` query
- `apps/web/server/routers/__tests__/memberships.logic.test.ts` — extend with the new procedure
- `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx` — replace `<CareTeamList members={[]} />` with the real query; pass through

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/components/app/CareTeamList.tsx` — pure presentational, do not change
- Any other router file
- Any migration file
- BACKLOG.md (per BACKLOG-as-SoT rule — feature PRs do NOT touch the backlog)

**Branch:** `feat/ux-103-careteamlist-data` off base SHA above.

**Implementation steps:**
1. Add `listForRecipient` procedure to `memberships.ts` with input schema `{ org_id: uuid, recipient_id: uuid }`. Verify caller is an accepted member of the org.
   - **Member name source:** `display_names` is keyed by `recipient_id` only and does NOT carry member names (verified). There is no member-profile cache table. Fetch each member's `user_metadata.name` via `supabaseAdmin.auth.admin.getUserById(id)` in a `Promise.all` over the membership list. This matches the only existing pattern (`apps/web/server/routers/user.ts:13`) for reading `user_metadata`. If `user_metadata.name` is absent, fall back to `'Member'`. Initials derived from name on the server before return.
   - Query: `memberships` rows for `(org_id, recipient_id)` → for each, resolve `auth_user_id` → user_metadata via the admin API. Return shape `{ id: string, name: string, role: string, phone?: string, initials?: string }[]` matching `CareTeamMember`. Phone is omitted (not in user_metadata; would need a separate source — defer to a follow-up).
2. Extend `memberships.logic.test.ts`: (a) auth boundary throws UNAUTHORIZED when ctx.user null, (b) cross-org membership throws FORBIDDEN, (c) returns shape matches `CareTeamMember[]`, (d) empty result returns `[]` not throw.
3. In `profile/page.tsx`, call the procedure server-side (the route is already a server component) and pass the result to `<CareTeamList members={members} />`.
4. Empty-state behavior preserved by CareTeamList itself (already handled).

**Acceptance (verifiable):**
- `cd apps/web && npx vitest run server/routers/__tests__/memberships.logic.test.ts` — all green, includes ≥4 new cases for `listForRecipient`
- `cd apps/web && npx tsc --noEmit` — clean
- `grep -nF 'members={[]}' 'apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx'` returns ZERO matches (single-quoted path per project zsh-glob gotcha)
- CI green on PR

**Risk + mitigations:**
- Risk: returning the raw `auth_user_id` could leak PHI if the join hits identity_vault directly. **Mitigation:** the route MUST pull display names from `display_names` cache table (org-scoped names are not PHI per ADR-0001) OR from a dedicated public profile (whichever the codebase already uses for member-name display). Do not select `identity_vault.full_name` directly into the response.

---

### Track 2 — UX-104 — wire LikesDislikesList to care_recipients.preferences

**Sources backlog UX-104.**

**FILES ALLOWED** (modify/create):
- `apps/web/server/routers/recipients.ts` — **CREATE NEW** (verified: file does not exist). Add `getPreferences(orgId, recipientId)` query returning `{ likes: string[], dislikes: string[] }`
- `apps/web/server/trpc/router.ts` — register the new `recipients` sub-router (verified: appRouter composition lives here, NOT under `routers/`)
- `apps/web/server/routers/__tests__/recipients.logic.test.ts` — **CREATE NEW** (verified: does not exist). Coverage for the new procedure. T3 will extend the same file — T2 should export reusable test fixtures (mock context factory, mock supabaseAdmin chain) to avoid T3 duplication.
- `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx` — replace `<LikesDislikesList likes={[]} dislikes={[]} />` with real props from the query

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/components/app/LikesDislikesList.tsx`
- Any migration file (existing `care_recipients.preferences jsonb` covers this — DO NOT add a new table)
- Any router file other than `recipients.ts` + the appRouter composition
- BACKLOG.md

**Branch:** `feat/ux-104-likes-dislikes-data` off base SHA, **rebased onto Track 1 after T1 merges** (because T2 also touches `profile/page.tsx`).

**Implementation steps:**
1. If `recipients.ts` router doesn't exist, create it with one procedure `getPreferences`. If it exists, add the procedure to it.
2. Procedure shape: input `{ org_id: uuid, recipient_id: uuid }`, output `{ likes: string[], dislikes: string[] }`. Default empty arrays when the jsonb shape doesn't have these keys.
3. Membership gate: caller must be an accepted member of `org_id`. Reuse the membership-check pattern used in `expenses.ts` / `burnout.ts`.
4. Tests: (a) auth boundary, (b) membership gate, (c) returns parsed jsonb shape, (d) returns `{likes:[], dislikes:[]}` when preferences jsonb is `{}` or missing the keys.
5. In `profile/page.tsx`, call the procedure and replace empty-prop mount.

**Acceptance (verifiable):**
- `cd apps/web && npx vitest run server/routers/__tests__/recipients.logic.test.ts` — green, ≥4 cases
- `cd apps/web && npx tsc --noEmit` — clean
- `grep -nF 'likes={[]} dislikes={[]}' 'apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx'` returns ZERO matches
- `ls supabase/migrations/2026051*` returns ZERO new files (the non-goal: NO new migration)
- CI green

**Risk + mitigations:**
- Risk: jsonb shape drift between writes and reads (no schema enforcement at DB level). **Mitigation:** validate the jsonb output with a Zod schema in the procedure; default to empty arrays on parse fail rather than throw, so an old/malformed blob doesn't break the page.

---

### Track 3 — UX-105 — wire EmergencyFooterCard to identity_vault.contact_info

**Sources backlog UX-105.**

**FILES ALLOWED** (modify/create):
- `apps/web/server/repositories/identityRepository.ts` — extend with `getEmergencyInfo(token)` returning `{ dnrStatus?, primaryContact?, hospital? }` parsed from `contact_info jsonb` (with PHI-aware membership check at the caller layer, not here)
- `apps/web/server/repositories/__tests__/identityRepository.test.ts` — coverage for the new helper
- `apps/web/server/routers/recipients.ts` — add `getEmergencyInfo(orgId, recipientId)` procedure that resolves identity_token → calls the repo helper → returns the shape `EmergencyFooterCard` expects
- `apps/web/server/routers/__tests__/recipients.logic.test.ts` — coverage for the new procedure (shares file with T2's tests; T3 must rebase onto T2)
- `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx` — replace `<EmergencyFooterCard />` with real props from the query

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/components/app/EmergencyFooterCard.tsx`
- Any migration file (existing `identity_vault.contact_info jsonb` covers this — DO NOT add new table)
- Any router file other than `recipients.ts`
- BACKLOG.md

**Branch:** `feat/ux-105-emergency-info-data` off base SHA, **rebased onto Track 2 after T2 merges** (page.tsx + recipients.ts both shared).

**Implementation steps:**
1. Add `getEmergencyInfo(token: string, orgId: string)` to `identityRepository.ts` matching the existing `resolveIdentity(token, orgId)` signature for parity. Pure data accessor — no auth check inside (caller does that). Parse `contact_info jsonb` for keys `dnr_status`, `primary_contact: { name, relationship?, phone? }`, `hospital`.
2. Add `recipients.getEmergencyInfo` procedure. Membership gate identical to T2. Resolve `recipient.identity_token` then call the repo helper. Return shape EmergencyFooterCard expects (`dnrStatus`, `primaryContact`, `hospital`).
3. Tests: (a) auth boundary, (b) membership gate, (c) parses correct jsonb shape, (d) returns `undefined` for missing fields (not throw — EmergencyFooterCard handles undefined gracefully per its prop types).
4. `profile/page.tsx`: call procedure, pass to `<EmergencyFooterCard {...emergency} />`.

**Acceptance (verifiable):**
- `cd apps/web && npx vitest run server/routers/__tests__/recipients.logic.test.ts server/repositories/__tests__/identityRepository.test.ts` — green
- `cd apps/web && npx tsc --noEmit` — clean
- `grep -nF '<EmergencyFooterCard />' 'apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx'` returns ZERO matches
- `ls supabase/migrations/2026051*` returns ZERO new files
- CI green

**Risk + mitigations:**
- **Risk: PHI exposure.** The emergency contact's name + phone are PHI per ADR-0001. They MUST stay behind identity_token resolution; do not surface them to clients other than authorized org members.
  - **Mitigation:** the procedure must run the membership gate BEFORE resolving the identity_token. If the membership check fails, throw FORBIDDEN before any identity_vault read. The PHI gate test must use a vitest mock to assert `identityRepository.getEmergencyInfo` was **NOT called** when the membership check fails — checking only the response status is insufficient because PHI could already be loaded into memory/log lines before the throw.
- Risk: jsonb shape drift (same as T2). Same mitigation: Zod-parse with permissive defaults.

## Merge order

**Strict sequential** — each track touches `profile/page.tsx` and T2/T3 share `routers/recipients.ts` + `recipients.logic.test.ts`:

T1 → T2 → T3

After T1 merges, rebase T2 onto updated origin/main; same for T3 after T2. /wave §3a "Direct" mode is the right execution shape for this — do NOT dispatch in parallel.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-10-recipient-profile-data-wiring.md` before /wave.

Then handed back to /sprint Gate 2.

## Post-merge verification

- `git pull && cd apps/web && npx tsc --noEmit && npx vitest run server/routers/__tests__/recipients.logic.test.ts server/routers/__tests__/memberships.logic.test.ts server/repositories/__tests__/identityRepository.test.ts`
- Live walkthrough: `pnpm web` → `/recipient/<some-id>/profile` → confirm CareTeamList shows real members, LikesDislikes shows real items (or empty state), EmergencyFooterCard shows real DNR/contact/hospital (or empty state).
- /post-deploy-watch optional — surfaces are read-only (no new write paths) so risk is low.

## Open questions

(none — all blockers resolved during opus-on-opus review pass)

## Review trail

- 2026-05-10 — opus-on-opus pass found 2 must-fix (T1 name source, zsh quoting) + 4 should-fix (file paths, missing-file hedge, signature parity, PHI test specificity). All applied inline.
