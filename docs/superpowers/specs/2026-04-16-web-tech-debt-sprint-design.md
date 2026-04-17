# Web Tech Debt Sprint — Design Spec
**Date:** 2026-04-16  
**Section:** `apps/web/` only  
**Parallelization:** TD-07 ∥ TD-08 ∥ TD-09 → TD-10 (gates on TD-07 + TD-09)

---

## Stories

### TD-07 — Alert → Toast sweep
**Size:** ~1 hr | **Tier:** Haiku | **Branch:** `feat/td07-alert-to-toast`

#### Problem
6 `alert()` calls remain in production UI. These block the main thread, look inconsistent, and can't be styled. `sonner` is now installed (PR #88).

#### Files
- `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx` — 3 alerts (lines 286, 300, 305)
- `apps/web/app/(app)/settings/page.tsx` — 1 alert (line 624)
- `apps/web/app/(app)/subscriptions/page.tsx` — 1 alert (line 186)
- `apps/web/app/(app)/team/admin/TeamAdminClient.tsx` — 1 alert (line 152)

#### Replacement rules
| Location | Old | New |
|---|---|---|
| `JournalClient.tsx:286` | `alert("Error generating care brief: ...")` | `toast.error("Error generating care brief: " + message)` |
| `JournalClient.tsx:300` | `alert("Invite link — copy and send to " + email + ":\n\n" + url)` | `navigator.clipboard.writeText(url)` then `toast.success("Invite link copied to clipboard")` |
| `JournalClient.tsx:305` | `alert("Error: ...")` | `toast.error("Error: " + message)` |
| `settings/page.tsx:624` | any `alert(...)` | `toast.error(...)` or `toast.success(...)` as appropriate |
| `subscriptions/page.tsx:186` | any `alert(...)` | `toast.error(...)` or `toast.success(...)` as appropriate |
| `TeamAdminClient.tsx:152` | any `alert(...)` | `toast.error(...)` or `toast.success(...)` as appropriate |

Import `toast` from `'sonner'` in each file. Do not add a second `<Toaster>` — it's already in `apps/web/app/(app)/layout.tsx`.

#### Acceptance criteria
- [ ] Zero `alert(` calls remain in `apps/web/` production code (excluding tests)
- [ ] Invite URL is copied to clipboard before showing success toast
- [ ] Errors use `toast.error`, success messages use `toast.success`
- [ ] `pnpm --filter web typecheck` clean
- [ ] `pnpm --filter web lint` clean

---

### TD-08 — Supabase types regen + `as any` cleanup
**Size:** ~1 hr | **Tier:** Haiku | **Branch:** `feat/td08-supabase-types-regen`

#### Problem
`apps/web/server/repositories/careEventCommentsRepository.ts` has 12 `as any` casts because the `care_event_comments` table migration (ON-44) was applied locally but `database.types.ts` was never regenerated. The file header says this explicitly.

#### Steps
1. Run `/supabase-types` skill (or `pnpm --filter web db:types`) to regenerate `apps/web/lib/database.types.ts` from the local Supabase instance.
2. Verify `care_event_comments` and `profiles` appear in the generated types.
3. In `careEventCommentsRepository.ts`: remove all `as any` and `(row: any)` casts; replace with the generated `Database['public']['Tables']['care_event_comments']['Row']` type (or a local alias).
4. Fix any type errors that surface after removal.

#### Files
- `apps/web/lib/database.types.ts` (regenerated — do not hand-edit)
- `apps/web/server/repositories/careEventCommentsRepository.ts`

#### Acceptance criteria
- [ ] Zero `as any` casts in `careEventCommentsRepository.ts`
- [ ] `care_event_comments` table is fully typed via generated types
- [ ] `pnpm --filter web typecheck` clean
- [ ] All existing tests still pass

#### Risk
If `supabase start` is not running or the `care_event_comments` migration hasn't been applied locally, the type generation will not include the table. Prerequisite: confirm `supabase status` shows running before starting.

---

### TD-09 — ShiftList edit mode
**Size:** ~2 hrs | **Tier:** Sonnet | **Branch:** `feat/td09-shift-edit-mode`

#### Problem
`ShiftPopover` has an Edit button wired to `() => { /* TODO: open ShiftForm in edit mode */ }`. Coordinators cannot edit shifts — they can only cancel and recreate.

#### Server: `shifts.update` tRPC mutation
Add to `apps/web/server/routers/shifts.ts`:

```typescript
update: protectedProcedure
  .input(z.object({
    id:                z.string().uuid(),
    org_id:            z.string().uuid(),
    assignee_user_id:  z.string().uuid(),
    start_at:          z.string().datetime(),
    end_at:            z.string().datetime(),
    notes:             z.string().max(500).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    await requireCoordinator(input.org_id, ctx.user.id);  // reuse existing helper
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .update({
        assignee_user_id: input.assignee_user_id,
        start_at:         input.start_at,
        end_at:           input.end_at,
        notes:            input.notes ?? null,
      })
      .eq('id', input.id)
      .eq('org_id', input.org_id)
      .select()
      .single();
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data;
  }),
```

No new migration needed — `shifts` table already has these columns.

#### ShiftForm: edit mode props
Add optional props:
```typescript
type Props = {
  // existing props...
  initialValues?: {
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM
    endTime: string;    // HH:MM
    assigneeId: string;
    notes: string;
  };
  shiftId?: string;     // present → edit mode
};
```

When `shiftId` is present:
- Pre-populate all state from `initialValues`
- Call `trpc.shifts.update.useMutation()` instead of `trpc.shifts.create`
- Button label: "Save changes" instead of "Add shift"
- On success: call `onSuccess()` and invalidate `shifts.list`

#### ShiftList: edit state
```typescript
const [editingShift, setEditingShift] = useState<Shift | null>(null);
```

Wire `onEdit` in `ShiftPopover`:
```typescript
onEdit={() => {
  setEditingShift(selectedShift);
  setSelectedShift(null);
}}
```

Render inline edit form when `editingShift` is set — below the calendar card, above the create form. Use the same expand/collapse Card pattern as ShiftForm create mode. Cancel clears `editingShift`.

`members` is already in `ShiftList`'s Props type — pass it through to ShiftForm.

#### Acceptance criteria
- [ ] Coordinator can click Edit on a shift popover, see ShiftForm pre-populated with existing values
- [ ] Saving updates the shift in the DB and refreshes the calendar
- [ ] Non-coordinators cannot call `shifts.update` (enforced server-side)
- [ ] `pnpm --filter web typecheck` + `pnpm --filter web test` clean

---

### TD-10 — JournalClient refactor
**Size:** ~2 hrs | **Tier:** Sonnet | **Branch:** `feat/td10-journal-client-refactor`  
**Prerequisite:** TD-07 and TD-09 merged to `main` first.

#### Problem
`JournalClient.tsx` is 624 lines with 10 `useState`, 3 `useRef`, 3 `useEffect`, 2 `useCallback`, and 6 top-level async functions. Three distinct concerns are entangled: data loading, offline queue management, and journal actions.

#### Extraction targets

**`apps/web/hooks/useJournalData.ts`**
Owns: `org`, `events`, `members`, `currentUserRole`, `loading`; functions `loadEvents`, `loadMembers`, `loadData` effect. Returns `{ org, events, members, currentUserRole, loading, loadEvents }`.

**`apps/web/hooks/useOfflineQueue.ts`**
Owns: `pendingQueueDepth`, `refreshQueueDepth`, `flushingRef`, `prevOnlineRef`, `flushQueue`, reconnect effect. Depends on `orgId` and `loadEvents` (passed in). Returns `{ pendingQueueDepth, flushQueue }`.

**`apps/web/hooks/useJournalActions.ts`**
Owns: `posting`, `showInvite`, `briefUrl`, `generatingBrief`; functions `handlePost`, `handleFlag`, `handleGenerateBrief`, `handleInvite`. Depends on `org`, `recipientId`, `loadEvents`, `isOnline`, queue functions. Returns all state + handlers.

**`JournalClient.tsx` after refactor (~150 lines)**
```typescript
export function JournalClient({ recipientId, user }: Props) {
  const { isOnline } = useOnlineStatus();
  const { org, events, members, currentUserRole, loading, loadEvents } = useJournalData(recipientId, user);
  const { pendingQueueDepth, flushQueue } = useOfflineQueue(org?.id ?? null, loadEvents);
  const actions = useJournalActions(org, recipientId, loadEvents, isOnline);

  if (loading) return <LoadingSpinner />;
  return <JournalLayout ... />;
}
```

#### Constraints
- **No behavior changes.** This is a pure structural refactor.
- Each hook must be independently importable and testable.
- Do not rename or change any exported types used by `JournalLayout` or its children.
- Existing tests in `JournalClient.flow.test.tsx` must continue to pass without modification to the test file itself. Update mocks only if import paths change.

#### Acceptance criteria
- [ ] `JournalClient.tsx` ≤ 200 lines after refactor
- [ ] Three new hook files created under `apps/web/hooks/`
- [ ] No behavior changes — all existing tests pass
- [ ] `pnpm --filter web typecheck` clean

---

## Parallelization map

```
TD-07 (alert sweep)     ──┐
TD-08 (types regen)     ──┤──► merge to main ──► TD-10 (JournalClient refactor)
TD-09 (shift edit mode) ──┘
```

TD-07 touches `JournalClient.tsx` in the function bodies of `handleGenerateBrief` and `handleInvite`. TD-09 does **not** touch `JournalClient.tsx` — `ShiftList` manages `editingShift` internally.

All three (TD-07, TD-08, TD-09) are safe to run fully in parallel.

TD-10 gates on TD-07 (needs the final toast-updated shape of `JournalClient.tsx` before refactoring it) and TD-09 (ensures shift edit is settled before restructuring the component that hosts `ShiftList`).

## Agent tier summary

| Story | Tier | Rationale |
|---|---|---|
| TD-07 | Haiku | Mechanical find-and-replace across 4 files |
| TD-08 | Haiku | Script-driven type regen + cast removal |
| TD-09 | Sonnet | New tRPC mutation + multi-file form state |
| TD-10 | Sonnet | Structural refactor requires judgment on hook boundaries |
