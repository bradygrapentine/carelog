# UX-053 — EmptyState primary-action affordances

**Date:** 2026-05-15
**Base SHA:** 6f5eb34
**Source backlog:** UX-053
**Recommended executor:** direct single-track (~30min)

## Goal

Audit found 6 `<EmptyState>` consumers, none using the component's `actionLabel`/`onAction` props. Hoist a primary-action CTA into the empty states for the 2 panels where the parent already has the affordance but it's currently buried in the CardHeader action slot: **MedicationPanel** (`+ Add` → "Add medication") and **TeamPanel** (`Invite someone` → "Invite a member"). Empty states become a focal CTA on first paint instead of relying on a small mobile-only header button.

Document the 4 remaining empty states as **intentionally passive** so the next /oop pass doesn't reopen this row.

## Audit table (background)

| Site | Existing affordance | Action |
|---|---|---|
| `MedicationPanel.tsx:250` | `+ Add` button in CardHeader (line 233, `isCoordinator && !showForm`-gated) | **CTA hoist** to EmptyState |
| `TeamPanel.tsx:329` | `Invite someone` button in CardHeader (line 137, `canInvite`-gated) | **CTA hoist** to EmptyState |
| `DocumentVault.tsx:223` | Upload form always-visible below for coordinators (line 427-) | **Passive — affordance already in view** |
| `JournalTimeline.tsx:579` | `JournalEntryForm` renders separately above the timeline | **Passive — affordance on the same page** |
| `MedicationLinkedDocs.tsx:29` | Data flows from doc upload + tagging elsewhere | **Passive by design (data-dependent)** |
| `MedicationRecentEvents.tsx:29` | Data flows from journal entries mentioning the medication | **Passive by design (data-dependent)** |

## Non-goals

- No new tRPC procedures, no new components, no schema changes.
- No copy changes to `title` or `description` strings.
- Don't touch the 4 passive sites' JSX. Add a single one-line `// UX-053: passive — <reason>` comment above each so future audits skip them.
- No accessibility audit beyond the existing `<Button>` focus-ring inheritance (the component already passes WCAG AA per ui-standards.md when actionLabel+onAction fires).

## Tracks

### Track 1 — Hoist CTAs to MedicationPanel + TeamPanel empty states + document passive sites

**FILES ALLOWED:**
- `apps/web/app/(app)/journal/[recipientId]/MedicationPanel.tsx` (add `actionLabel` + `onAction` to EmptyState at line 250, coordinator-gated; passive sites are not here)
- `apps/web/app/(app)/journal/[recipientId]/TeamPanel.tsx` (add `actionLabel` + `onAction` to EmptyState at line 329, canInvite-gated)
- `apps/web/app/(app)/journal/[recipientId]/DocumentVault.tsx` (add `// UX-053: passive — upload form below is always-visible for coordinators` comment above EmptyState at line 222)
- `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx` (add `// UX-053: passive — JournalEntryForm renders on this page above the timeline` comment above EmptyState at line 578)
- `apps/web/components/medications/MedicationLinkedDocs.tsx` (add `// UX-053: passive — links populate from doc tagging elsewhere` comment above EmptyState at line 28)
- `apps/web/components/medications/MedicationRecentEvents.tsx` (add `// UX-053: passive — entries populate from journal log` comment above EmptyState at line 28)
- Test files: only if existing test for MedicationPanel / TeamPanel asserts on the EmptyState rendering and needs `actionLabel` accommodation. Read the test file first; do not add new assertions.

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/components/ui/EmptyState.tsx` — its props are correct; we're using existing API
- `apps/web/components/ui/__tests__/EmptyState.test.tsx` — already covers actionLabel/onAction behavior
- Any panel-level Button or tRPC code — affordance hoisting reuses existing setShowForm / onToggleInvite handlers

**Branch:** `feat/ux-053-empty-state-affordances`

**Implementation steps:**

1. **MedicationPanel.tsx:249-255** — wrap the EmptyState invocation with `isCoordinator`-conditional `actionLabel`/`onAction`:
   ```tsx
   <EmptyState
     icon={Pill}
     title="No medications tracked"
     description="Track medications, dosages, and schedules to keep the whole team informed."
     actionLabel={isCoordinator ? "Add medication" : undefined}
     onAction={isCoordinator ? () => setShowForm(true) : undefined}
   />
   ```
   Verify `isCoordinator` is in scope at line 250 (it's referenced at the line-233 header). Verify `setShowForm` is in scope (referenced at line 235).

2. **TeamPanel.tsx:329** — same pattern with `canInvite`/`onToggleInvite`:
   ```tsx
   <EmptyState
     icon={Users}
     title="Just you so far"
     description="Invite family members or caregivers to collaborate on care coordination."
     actionLabel={canInvite ? "Invite a member" : undefined}
     onAction={canInvite ? onToggleInvite : undefined}
   />
   ```
   Verify `canInvite` and `onToggleInvite` are in scope at line 329 (both referenced at the line-137 header).

3. Add the 4 single-line `// UX-053: passive — <reason>` comments to DocumentVault, JournalTimeline, MedicationLinkedDocs, MedicationRecentEvents on the line directly above each `<EmptyState`.

4. Run `cd apps/web && npx tsc --noEmit` — clean.

5. Run `cd apps/web && npx vitest run` — full suite green.

6. Manual verify (skim): `MedicationPanel.test.tsx` and `TeamPanel.test.tsx` (if they exist) — do any assertions read `actionLabel`/`onAction`-related text? If yes and they currently expect those absent, update to expect the new label-when-coordinator behavior. If tests don't exist or don't cover this branch, no test changes.

**Acceptance (verifiable):**

- `cd apps/web && npx tsc --noEmit` exits 0
- `cd apps/web && npx vitest run` exits 0, all currently-passing tests stay green
- `grep -c "<EmptyState" apps/web/app/\(app\)/journal/\[recipientId\]/MedicationPanel.tsx apps/web/app/\(app\)/journal/\[recipientId\]/TeamPanel.tsx` returns the same count (1 each — no duplication)
- `grep -c "actionLabel" apps/web/app/\(app\)/journal/\[recipientId\]/MedicationPanel.tsx apps/web/app/\(app\)/journal/\[recipientId\]/TeamPanel.tsx` returns 1 each
- `grep "UX-053: passive" apps/web -r --include="*.tsx"` returns 4 matches (DocumentVault, JournalTimeline, MedicationLinkedDocs, MedicationRecentEvents)
- Pre-commit vitest hook green

**Risk + mitigations:**

- **Risk:** A snapshot or text-query test against the affected panels asserts the empty state has NO button. **Mitigation:** Step 6 instructs reading the relevant test files first; failures surface in pre-commit. If a snapshot mismatch is the failure mode, regenerate (`vitest -u`) intentionally for just the affected file.
- **Risk:** `isCoordinator` / `canInvite` truthy at render but the actionLabel + onAction props don't both flip in lockstep (e.g. one is set without the other). **Mitigation:** `EmptyState.tsx:20` requires BOTH `actionLabel && onAction` — null on either side suppresses the button cleanly. Already-handled in the component.
- **Risk:** Test renders TeamPanel/MedicationPanel in non-coordinator mode and the EmptyState text changes break a label-presence assertion. **Mitigation:** The `actionLabel` is undefined when non-coordinator → no button rendered → existing description-only assertions still pass.

## Merge order

Single track; ships as one PR.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-15-ux-053-empty-state-affordances.md --from-sprint` before commit. Apply must-fix findings.

## Post-merge verification

- `/oop --from-sprint` light pass on the 6 touched files — expect 0 must-fix (cosmetic affordance addition).
- No `/post-deploy-watch` needed.

## Open questions

None.
