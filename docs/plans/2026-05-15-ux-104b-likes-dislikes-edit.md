# UX-104b — Edit affordance for LikesDislikesList on recipient profile

**Date:** 2026-05-15
**Base SHA:** 6f5eb34 (will rebase to current main at branch-cut)
**Source backlog:** UX-104b
**Recommended executor:** direct single-track (~1h)

## Goal

Add inline edit mode to `LikesDislikesList` for coordinators on `/recipient/[recipientId]/profile`. Writes back to `care_recipients.preferences jsonb` via a new `recipients.updatePreferences` tRPC mutation. Non-coordinators see read-only view (current behavior preserved). PHI: not applicable per row — preferences are not identity-bound (free-text food/activity strings, not medical or contact data).

## Non-goals

- No new DB schema work — `care_recipients.preferences` jsonb column already exists, read path already ships via `getRecipientPreferences` in `apps/web/server/repositories/recipientsRepository.ts:26`.
- No PHI surface — preferences explicitly out-of-scope for ADR-0001 per the backlog row.
- No bulk import / file upload of preferences. Inline string edit only.
- No history / audit trail (different from `eol_plans` which has audit needs).
- Don't touch the read-only display when the caller is non-coordinator.
- Don't touch UX-103b (CareTeamList edit) or UX-105b (EmergencyFooter PHI edit) — they ship separately.

## Tracks

### Track 1 — recipients tRPC mutation + edit-mode UI

**FILES ALLOWED** (modify/create):
- `apps/web/server/routers/recipients.ts` **(new)** — router with one `updatePreferences` mutation
- `apps/web/server/trpc/router.ts` — register `recipients: recipientsRouter` (one line added, alphabetic-ish placement near `organizations`)
- `apps/web/components/app/LikesDislikesList.tsx` — convert to client component, add edit mode (add/remove items, Save, Cancel) gated on `canEdit` prop
- `apps/web/components/app/__tests__/LikesDislikesList.test.tsx` — extend existing read-only tests with edit-mode cases (non-coordinator branch stays as-is)
- `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx` — fetch caller's role for the recipient's org; pass `canEdit` + `orgId` + `recipientId` to `<LikesDislikesList>`
- `apps/web/server/routers/__tests__/recipients.test.ts` **(new)** — coordinator-gate (FORBIDDEN for non-coordinator + non-member), recipient-must-belong-to-org check, jsonb shape validation, happy-path write

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/server/repositories/recipientsRepository.ts` — read path stays; if a write helper is wanted later, that's a follow-up. Keep the mutation logic inline in the router for now (one-shot, no second consumer yet).
- `supabase/migrations/*` — column already exists, no migration needed
- `supabase/tests/*` — no RLS surface change; `care_recipients` already has org-scoped RLS, mutation uses `supabaseAdmin` gated by explicit `assertCoordinator` + org-membership check (eolPlan pattern)
- Other recipient-profile components (`RecipientProfile`, `CareTeamList`, `EmergencyFooterCard`)
- Any analytics call (posthog.capture). Don't add events here — wait until UX-104b lands and we know what's useful to measure.

**Branch:** `feat/ux-104b-likes-dislikes-edit` off current `origin/main`.

**Implementation steps:**

1. **Create `apps/web/server/routers/recipients.ts`.** Follow `eolPlan.ts:1-60` as the template (memberships gate + recipient-belongs-to-org check + supabaseAdmin write). Zod input lives **in this file** (NOT lifted to `recipientsRepository.ts`):
   ```ts
   // Write-side schema. Intentionally stricter than the read-side
   // PreferencesSchema in recipientsRepository.ts:4-7 (which is permissive
   // with defaults to tolerate legacy jsonb blobs). Don't consolidate —
   // permissive read + strict write is the correct asymmetry for jsonb.
   const updatePreferencesInput = z.object({
     org_id: z.string().uuid(),
     recipient_id: z.string().uuid(),
     likes: z.array(z.string().trim().min(1).max(120)).max(50),
     dislikes: z.array(z.string().trim().min(1).max(120)).max(50),
   });
   ```
   Per-item caps: 120 chars (room for "wheat bread without butter at breakfast" — generous). Array caps: 50 each (way more than any real list; defense-in-depth against jsonb bloat). Use `.trim().min(1)` to reject pure whitespace. **Dedup nit (TD-X candidate):** zod doesn't dedup; add a `// TODO(ux-104b-followup): dedup likes/dislikes case-insensitively if duplicate-entry friction surfaces` comment near the schema rather than implementing here. Use `assertCoordinator(input.org_id, ctx.user.id)` then verify recipient exists in that org via the same single-row lookup pattern at `eolPlan.ts:48-56`, then `supabaseAdmin.from("care_recipients").update({ preferences: { likes, dislikes } }).eq("id", input.recipient_id).eq("org_id", input.org_id)`. Wrap errors with `wrapAdminError`. Return `{ ok: true, likes, dislikes }` (echo back the saved values for client-side state reconciliation).

2. **Register the router in `apps/web/server/trpc/router.ts`.** Add import + entry. **Append at the bottom of the imports list AND the `appRouter({...})` map** — the existing file is intent-grouped (not alphabetic). Appending keeps the diff scoped and reduces merge-conflict risk with parallel work.

3. **Convert `apps/web/components/app/LikesDislikesList.tsx` to client component.** Add `"use client"` at top. Props become:
   ```ts
   type LikesDislikesListProps = {
     likes: string[];
     dislikes: string[];
     orgId?: string;       // required when canEdit
     recipientId?: string; // required when canEdit
     canEdit?: boolean;    // default false; non-coordinator path stays read-only
     className?: string;
   };
   ```

   **Required shape: subcomponent carve-out.** The existing test at `LikesDislikesList.test.tsx:1-3` uses plain `render` from `@testing-library/react` with no tRPC provider. `useMutation` is an unconditional hook at render — having it at the top level of `LikesDislikesList` would red the existing 6 tests on first render even when `canEdit=false`. Mandatory shape:

   ```tsx
   export function LikesDislikesList({ likes, dislikes, orgId, recipientId, canEdit, className }: LikesDislikesListProps) {
     // Read-only render path — no tRPC hooks reached here. Existing tests stay green.
     if (!canEdit) return <ReadOnlyView likes={likes} dislikes={dislikes} className={className} />;
     // Edit-capable variant lives in a nested component so its useMutation
     // call is only reached when canEdit is true. Tests that render the
     // read-only path do not need a tRPC provider.
     return <EditableView initialLikes={likes} initialDislikes={dislikes} orgId={orgId!} recipientId={recipientId!} className={className} />;
   }
   ```

   `ReadOnlyView` is the existing markup (the current default export's body — keep `<section aria-labelledby>` / `eyebrow-mono` / list-disc structure byte-identical). `EditableView` is the new client component that:
   - Owns `useState` seeded from `initialLikes` / `initialDislikes` (one snapshot — see prop-drift note below).
   - Renders the same two-column layout. Initial mode is read-display with a single "Edit" button below the columns. Edit button has visible focus ring per ui-standards.md (`focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2`).
   - On Edit click, swaps each `<li>` for an `<Input>` row; each row has a remove `×` button with `aria-label={"Remove " + item}` (ui-standards.md icon-only rule). An "Add" button below each column appends an empty input. Save + Cancel buttons live at the bottom; both have the standard focus-ring.
   - Save → `trpc.recipients.updatePreferences.useMutation()` with `{ org_id: orgId, recipient_id: recipientId, likes, dislikes }`. On success: exit edit mode, replace local state with the server's echoed values, then call `router.refresh()` (from `next/navigation`) so the server component re-fetches and a subsequent prop-driven render is consistent.
   - On failure: `sonner` toast with the error message; remain in edit mode so the user can retry without losing their input.
   - Cancel reverts local state to the initial snapshot and exits edit mode.

   **Prop-drift acknowledgment (cycle-1 MF1):** `EditableView` seeds `useState` from props once at first mount. Subsequent prop changes from the server component (e.g. via `router.refresh()` triggered elsewhere) only re-flow when the component remounts. This is the intentional shape — `router.refresh()` after Save triggers a server re-render so the NEXT mount sees the updated values. Within a single edit session, the user's draft state stays the source of truth (correct). If a parallel coordinator edits simultaneously, last-write-wins applies — already acknowledged in Risk section, follow-up row if real.

   Keep the read-only display path byte-identical when `!canEdit`.

4. **Extend `apps/web/components/app/__tests__/LikesDislikesList.test.tsx`.** Read it first to see current shape — it already has 6 tests (per Phase 0 grep, "LikesDislikesList" appears in the file). Existing tests pass `likes`/`dislikes` only (no edit props) — those keep passing because `canEdit` defaults to false. Add 3 new tests:
   - Renders edit button when `canEdit=true`
   - Clicking edit swaps to editable inputs; clicking cancel reverts
   - Clicking save calls the mutation with the right args (use vi.mock on `trpc.recipients.updatePreferences.useMutation` returning a spy `mutate` fn)

5. **Update `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx`.** After the `recipient` lookup but before/alongside the `Promise.all`, add a membership lookup to determine `isCoordinator`:
   ```ts
   const { data: membership } = await supabase
     .from("memberships")
     .select("role")
     .eq("org_id", recipient.org_id)
     .eq("user_id", user.id)
     .not("accepted_at", "is", null)
     .maybeSingle();
   const isCoordinator = membership?.role === "coordinator";
   ```
   Use `supabase` (session-scoped) not `supabaseAdmin` — RLS scopes memberships to the caller's own rows, which is what we want. Pass `orgId={recipient.org_id} recipientId={recipient.id} canEdit={isCoordinator}` to `<LikesDislikesList>`.

6. **Create `apps/web/server/routers/__tests__/recipients.test.ts`.** Mirror `eolPlan.test.ts` (if it exists; otherwise mirror `medications.test.ts` shape). Test cases:
   - `updatePreferences` throws FORBIDDEN when caller has no membership in `org_id`
   - throws FORBIDDEN when caller is a caregiver (not coordinator)
   - throws FORBIDDEN when `recipient_id` doesn't belong to `org_id` (recipient exists in another org)
   - rejects pure-whitespace items (zod trim+min)
   - rejects arrays >50 items
   - rejects items >120 chars
   - happy path: coordinator + valid payload → calls supabaseAdmin update with `{ preferences: { likes, dislikes } }`

**Acceptance (verifiable):**

- `cd apps/web && npx tsc --noEmit` exits 0
- `cd apps/web && npx vitest run` exits 0; ~9 new tests pass (3 component + 6+ router); all currently-passing tests stay passing
- New `recipients` router visible in `appRouter` (grep `recipients:` in `server/trpc/router.ts` returns 1 match)
- `grep -c "use client" apps/web/components/app/LikesDislikesList.tsx` returns 1
- Coordinator user can submit a Save action; the mutation reaches the router with sanitized payload (verified by router unit test)
- Non-coordinator user (caregiver or non-member) sees read-only view (verified by component test + router FORBIDDEN test)
- Manual smoke (operator, not gate): load `/recipient/<id>/profile` as a coordinator, click Edit, add "Pickled okra", Save, refresh → entry persists

**Risk + mitigations:**

- **Risk:** jsonb concurrent-write race — two coordinators editing simultaneously, last-write-wins overwrites the other. **Mitigation:** acknowledged & accepted at this scope. The row is two coordinator-edited string arrays; collision likelihood is low. If real, follow-up backlog row for an optimistic-lock via `preferences->>'updated_at'` timestamp comparison. Document in plan.
- **Risk:** Adding a server-side membership query to the profile page adds one DB round-trip per render. **Mitigation:** the existing `Promise.all` already does 3 lookups; adding a 4th to the same array keeps it parallel and adds ~10ms p50. Acceptable.
- **Risk:** Existing `LikesDislikesList` tests use `<LikesDislikesList likes={...} dislikes={...} />` shape and might call `render()` without a tRPC provider. The new client component will reference `trpc.recipients...` even when `canEdit=false`. **Mitigation:** import `trpc` at the top, but only call `useMutation()` inside an `if (canEdit)` branch or a sub-component conditionally rendered. Or: ensure existing tests still pass by NOT calling `useMutation` at module load — call it inside a `useState`-gated effect or sub-render. Safest: extract the edit-mode UI into a nested `<LikesDislikesEditor>` subcomponent rendered only when `canEdit && isEditing`. That sub-component owns the `useMutation` call, so non-edit renders don't need a tRPC provider in tests.
- **Risk:** The Zod cap of 50 items might be too low for some real lists. **Mitigation:** 50 is intentionally generous; real lists are <10 items per row author's likely intent. If users hit it, follow-up.

## Merge order

Single track; ships as one PR.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-15-ux-104b-likes-dislikes-edit.md --from-sprint` before commit. Apply must-fix findings.

## Post-merge verification

- `/oop --from-sprint` light pass on the touched files. Expect ≤1 should-fix (likely the optimistic-lock follow-up).
- No `/post-deploy-watch` — additive UI feature, no migration, no public surface change beyond the new tRPC route.

## Open questions

None.
