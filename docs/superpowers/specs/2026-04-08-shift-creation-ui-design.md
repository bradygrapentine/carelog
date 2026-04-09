# P2-02 Shift Creation UI — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Backlog story:** P2-02

---

## Context

P2-01 shipped the `shifts` tRPC router and Zod schema. P2-02 adds the coordinator-only form
that calls `shifts.create`. P2-03 will add the shift list that consumes `shifts.list`.

`TrpcProvider` wraps the entire app in `layout.tsx` — tRPC hooks are available in any
client component without additional setup.

---

## Component structure

### New: `apps/web/app/journal/[recipientId]/ShiftForm.tsx`

Self-contained collapsible card. Owns:
- Collapsed / expanded state
- `trpc.shifts.create.useMutation()` hook
- Submit loading and error state

Props:
```ts
interface Props {
  members:     Member[]   // already fetched by JournalClient
  recipientId: string
  orgId:       string
  onSuccess:   () => void // no-op until P2-03 wires list refresh
}
```

Collapsed: renders a single `+ Schedule a shift` button styled to match the existing card aesthetic.
Expanded: renders the full form.

### Modified: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

Add between `<TeamPanel>` and `<JournalTimeline>` (inside the `mt-6` spacing pattern):

```tsx
{currentUserRole === 'coordinator' && org && (
  <div className="mt-6">
    <ShiftForm
      members={members}
      recipientId={recipientId}
      orgId={org.id}
      onSuccess={() => {}}
    />
  </div>
)}
```

No new state in `JournalClient` — `ShiftForm` is fully self-contained.

---

## Form fields

All form values are read synchronously at the top of the submit handler before any `await`
(ENTERPRISE_PRINCIPLES #5). No template literals in JSX props (ENTERPRISE_PRINCIPLES #1).

| Field | Input | Notes |
|---|---|---|
| Date | `<input type="date">` | Defaults to today |
| Start time | `<input type="time" step="1800">` | 30-min steps |
| Duration | `<select>` | 1h, 2h, 4h, 8h, Custom |
| End time | `<input type="time">` | Only visible when Duration = Custom |
| Assignee | `<select>` | Members filtered to `role !== 'supporter'`; shows `display_name ?? email` |
| Notes | `<textarea>` | Optional, max 2000 chars |

---

## Data flow

1. User fills form, clicks Submit
2. Handler reads all field values synchronously into local variables
3. Computes `start_at` and `end_at` as ISO strings from date + start time + duration
4. Calls `trpc.shifts.create.mutateAsync({ org_id, recipient_id, assignee_user_id, start_at, end_at, notes })`
5. On success: collapse form, reset all fields, call `onSuccess()`
6. On `CONFLICT` TRPCError: show inline — "This person already has a shift at that time."
7. On any other error: show inline — "Something went wrong. Please try again."

Submit button is disabled when assignee is not selected or mutation is in flight.

---

## Error handling

- Inline error message beneath the form fields — no modal, no toast
- Error clears when the user changes any field
- Form does not close on error (user can correct and resubmit)

---

## Styling

Match existing card aesthetic: `bg-white border border-gray-100 rounded-xl shadow-sm`.
Collapsed trigger: muted `+ Schedule a shift` text button — calm, not prominent.
Form inputs: consistent with `JournalEntryForm` sizing (`text-sm`, `px-4 py-3`).
Submit: `bg-gray-900 text-white rounded-lg` matching existing primary button style.

---

## Testing

File: `apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx`

| Test | Approach |
|---|---|
| Coordinator sees ShiftForm, supporter does not | Render `JournalClient` with mocked role |
| Assignee dropdown excludes supporters | Render `ShiftForm` with mixed member list |
| Submit disabled when no assignee selected | Assert button `disabled` attribute |
| Custom duration shows end time input | Simulate duration select change |
| Fixed duration hides end time input | Assert end time input absent |
| `shifts.create` called with correct ISO strings | Mock tRPC mutation, assert call args |
| CONFLICT error renders inline message | Mock mutation rejection with `CONFLICT` code |
| On success: form collapses, `onSuccess` called | Assert collapsed state + mock fn called |

No E2E tests — P2-03 shift list does not exist yet, so no post-submit visibility to verify.

---

## What this does NOT include

- P2-03 shift list (separate story — `onSuccess` is a no-op until then)
- Optimistic UI (low-frequency action, not required per backlog)
- Recurring shift toggle (P2-06)
- Any changes to tRPC router or Zod schema (P2-01 is the foundation)
