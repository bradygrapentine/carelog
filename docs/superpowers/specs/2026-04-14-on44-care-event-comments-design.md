# ON-44 — Comment threads on care events

**Status:** Design approved 2026-04-14
**Estimate:** ~1.5 days
**Backlog row:** `docs/BACKLOG.md` §ON-44

## Summary

Caregivers can comment on individual care events (journal entries). Flat list, no nesting. Soft-delete only, author-only edit/delete, in-app realtime + push to the event author and prior commenters. Matches the messaging pattern shipped in ON-43.

## Decisions locked during brainstorming

| # | Decision |
|---|---|
| Q1 | Soft-deleted comments vanish entirely from `list` for everyone (row retained for audit) |
| Q2 | Edits allowed forever; "edited" badge with `edited_at` tooltip after any edit |
| Q3 | Push notifications go to event author + distinct prior commenters (excluding the current commenter). Respects `notification_preferences` |
| Q4 | No rate limiting (small-trust family network; add later if abuse appears) |
| Arch | Notification fanout via Inngest worker (`careEventComment.created`), not inline in the tRPC mutation |

## 1. Data model

```sql
create table care_event_comments (
  id uuid primary key default gen_random_uuid(),
  care_event_id uuid not null references care_events(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 4000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on care_event_comments (care_event_id, created_at);
create index on care_event_comments (org_id);
```

`org_id` is denormalized for RLS performance (same pattern as `care_events`, `messages`). `ON DELETE CASCADE` on `care_event_id` is intentional — deleting an event removes its comments.

### RLS

- **select** — member of the event's org (mirrors `care_events` policy)
- **insert** — org member, `author_id = auth.uid()`, `org_id` matches the event's org
- **update** — author-only; may modify `body` and `edited_at`, plus `deleted_at` for soft delete
- **delete** — prohibited at the policy level; soft-delete only

### Supporting migration

Adds `care_event_comments boolean default true` to `notification_preferences`.

## 2. tRPC API — `careEvents.comments`

```ts
list({ careEventId })
  → { id, authorId, authorName, body, editedAt, createdAt }[]
  // ordered by created_at asc, deleted_at IS NULL
  // joins profiles for authorName (avoid N+1 on client)

add({ careEventId, body })
  → { id, createdAt }
  // trims body, validates 1–4000 chars
  // publishes Inngest event `careEventComment.created` after insert commits

edit({ commentId, body })
  → { editedAt }
  // author-only (RLS enforces), sets edited_at = now()

remove({ commentId })
  → { ok: true }
  // author-only, sets deleted_at = now()
```

Validation via Zod schemas in `apps/web/server/schemas/careEventComments.ts`.

## 3. Realtime + notifications

### Supabase Realtime

- Channel `care_event_comments:care_event_id=eq.{id}` subscribed on mount of the comment block
- `INSERT` → append; `UPDATE` setting `deleted_at` → remove; `UPDATE` changing `edited_at` → patch body
- Cleaned up on unmount

### Inngest fanout

- Event: `careEventComment.created` — payload `{ commentId, careEventId, orgId, authorId, body }`
- Worker `careEventComment.fanout` in `apps/web/server/inngest/careEventComments.ts`:
  1. Fetch `care_events.created_by` (event author)
  2. Fetch distinct `care_event_comments.author_id` where `care_event_id = X` and `author_id != authorId`
  3. Union recipients, exclude current commenter
  4. Per recipient: check `notification_preferences.care_event_comments` (default true) → `sendPush`
- Push payload: title `"New comment on <event-title>"`, body first 120 chars of comment, deep-link `/journal/<careEventId>#comments`

No artificial delay (unlike message read-receipt suppression in ON-43 — comments have no read-receipt concept).

## 4. Web UI

**Location:** collapsible block beneath each `CareEventCard` in the journal feed and on the entry-detail page.

**Collapsed state**
- Row: `💬 3 comments` (or `💬 Add a comment` when 0)
- `var(--color-primary-subtle)` background, `var(--color-border)` top border, tap target ≥40×40 px, visible focus ring
- Clicking toggles; state persists in URL hash `#comments-<id>` so deep-links land expanded

**Expanded state**
- Chronological list (oldest first)
- Per comment: avatar initials, author name, relative timestamp, "edited" badge when `editedAt` present, body
- Author sees inline Edit / Delete icon buttons (`aria-label`, confirm dialog for delete)
- Composer at bottom: `<Textarea>` (counter appears at 3500+ chars), Post / Cancel

**Edit mode:** inline — textarea replaces body, Save / Cancel buttons.

**New components**
- `apps/web/components/care-events/CommentThread.tsx` — list + subscription
- `apps/web/components/care-events/CommentComposer.tsx` — textarea + submit
- `apps/web/components/care-events/CommentItem.tsx` — single comment + edit/delete

Must pass the UI checklist in `.claude/rules/ui-standards.md`: tokens only (no raw hex), ≥4.5:1 contrast, keyboard-reachable, visible focus, labels on every input, `aria-label` on icon-only buttons.

## 5. Mobile UI

**Location:** tapping a journal entry opens the event-detail screen; comments live in a `<CommentSection />` at the bottom.

- No collapse toggle — detail screen is already dedicated to this event
- `FlatList` rendering oldest→newest
- Composer docked at bottom with `KeyboardAvoidingView`; send button disabled when empty or >4000 chars
- Pull-to-refresh; Realtime subscription appends live
- Long-press on own comment → action sheet (Edit / Delete)
- Edit opens a bottom sheet with textarea + Save / Cancel
- Push notification tap deep-links to `/journal/[careEventId]#comments` and scrolls to the section

**New files**
- `apps/mobile/components/comments/CommentSection.tsx`
- `apps/mobile/components/comments/CommentComposer.tsx`
- `apps/mobile/components/comments/CommentItem.tsx`
- `apps/mobile/app/journal/[id].tsx` — mounts `<CommentSection />`

## 6. Testing

### pgTAP — `supabase/tests/care_event_comments.test.sql`

- Org member can insert, list, edit-own, soft-delete-own
- Cross-org user: cannot list, insert, edit, or soft-delete
- Non-author same-org user: cannot edit, cannot soft-delete
- Soft-deleted row omitted from `select`
- `body` length check enforces 1–4000 characters

### Vitest — `apps/web/server/routers/careEvents.comments.test.ts`

- `list` returns non-deleted only
- `add` publishes Inngest event with correct payload
- `edit` sets `edited_at`
- `remove` sets `deleted_at`
- Worker: recipients = event author + prior commenters − current commenter
- Worker: skips recipients whose `notification_preferences.care_event_comments = false`

### E2E — `e2e/care-event-comments.spec.ts`

Post → appears → second browser sees realtime insert → edit updates in both → delete makes it vanish in both.

## 7. Out of scope

- Nested replies / threading
- Reactions / emoji
- @-mentions
- Rate limiting
- Admin / coordinator moderation tools
- Notification digest (daily summary of comments)
