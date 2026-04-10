# Mobile Wave 4 — Journal Polish Design

## Goal

Bring the mobile journal to feature parity with the web: tappable timeline entries with inline expand, emoji reactions via tRPC, and a full-screen detail view with coordinator-only flagging.

## Scope

**In scope:**
- Timeline entry cards: mood badge, reaction summary, tappable to expand inline
- Inline expand: full text, 4 reaction buttons with live counts, "Open entry" button
- Full-screen detail screen: full text, mood, reactions, flag button (coordinator only)
- New tRPC procedures: `react`, `unreact`, `reactions`, `flag`
- New DB table: `care_event_reactions`
- `AppContext` extended with `userRole`

**Out of scope (deferred to v2):**
- Coordinator-controlled flag access: per-member toggle (`memberships.can_flag`) and org-wide role setting (`organizations.flag_roles`)

---

## Data Layer

### DB — `care_event_reactions`

```sql
CREATE TABLE care_event_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction    text NOT NULL CHECK (reaction IN ('heart','thinking_of_you','strong','grateful')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)   -- one reaction per user per event
);
```

RLS policies:
- `SELECT` — org members can read reactions for events in their org
- `INSERT` — users can insert their own reactions only (`user_id = auth.uid()`)
- `DELETE` — users can delete their own reactions only

### tRPC — additions to `careEventsRouter`

```ts
type ReactionKey = 'heart' | 'thinking_of_you' | 'strong' | 'grateful'

careEvents.reactions  // query
  input:  { eventId: string (uuid) }
  output: { counts: Record<ReactionKey, number>, myReaction: ReactionKey | null }

careEvents.react      // mutation
  input:  { eventId: string (uuid), reaction: ReactionKey }
  // upserts — replaces prior reaction if user reacts with a different emoji
  output: void

careEvents.unreact    // mutation
  input:  { eventId: string (uuid) }
  // no-op if user has no reaction
  output: void

careEvents.flag       // mutation
  input:  { eventId: string (uuid), flagged: boolean }
  // throws FORBIDDEN if caller's membership role !== 'coordinator'
  output: void
```

---

## Mobile UI

### AppContext extension

Add `userRole: 'coordinator' | 'caregiver' | 'aide' | 'supporter' | null` to `AppContext`. Fetched alongside `orgId`/`recipientId` from the memberships query on app load. Used by the detail screen to show/hide the flag button without an extra fetch.

### Timeline — `app/(app)/journal/index.tsx`

Each entry card renders:
- Time (existing)
- Text truncated to 2 lines (existing, add `numberOfLines={2}`)
- Mood badge (colored pill, same palette as web)
- Reaction summary: show emoji + count for reactions with count > 0 (e.g. "❤️ 2 🤍 1")

Tap behavior:
- Tap a collapsed entry → expands inline; any previously expanded entry collapses first (only one open at a time)
- Tap an expanded entry → collapses
- Expanded state shows: full text (no line clamp), all 4 reaction buttons with counts, "Open entry →" button

State: `expandedId: string | null` in component state.

### Detail screen — `app/(app)/journal/[eventId].tsx`

New Expo Router screen. Loads:
- `trpc.careEvents.getOne.useQuery({ eventId })` — event data
- `trpc.careEvents.reactions.useQuery({ eventId })` — reaction counts + myReaction

Renders:
- Back button (stack navigation)
- Full entry text
- Mood badge
- Date + time (long format)
- 4 reaction buttons; active reaction highlighted; tap toggles (`react` / `unreact` mutation)
- Flag button — visible only when `userRole === 'coordinator'`; label toggles "Flag for doctor" / "Unflag"; calls `careEvents.flag` mutation; optimistic UI update

Navigation: from timeline inline expand, tapping "Open entry →" calls `router.push('/journal/' + eventId)`.

---

## Testing

### tRPC router — Vitest (`careEventsRouter.security.test.ts` + new `careEventsRouter.reactions.test.ts`)

| Test | Assertion |
|---|---|
| `react` stores reaction | row exists in `care_event_reactions` |
| `react` twice with different emoji | upserts — only one row, new emoji |
| `unreact` removes reaction | row gone |
| `unreact` with no prior reaction | no error (no-op) |
| `reactions` returns correct counts | counts match inserted rows |
| `reactions` returns `myReaction` | matches caller's reaction |
| `flag` by coordinator | `care_events.flagged` toggled |
| `flag` by non-coordinator | throws FORBIDDEN |

### Mobile — jest-expo

| Component | Test |
|---|---|
| `JournalScreen` | mood badge renders for each mood value |
| `JournalScreen` | tap expands entry; second tap collapses |
| `JournalScreen` | only one entry expanded at a time |
| `JournalScreen` | reaction summary shows counts > 0 |
| `JournalDetailScreen` | renders full text and mood |
| `JournalDetailScreen` | reaction buttons reflect `myReaction` |
| `JournalDetailScreen` | flag button present for coordinator role |
| `JournalDetailScreen` | flag button absent for caregiver/supporter/aide |

### DB — pgTAP (`care_event_reactions_rls.test.sql`)

- Org member can insert their own reaction
- Org member cannot insert reaction with another user's `user_id`
- Org member can read all reactions for events in their org
- Org member cannot delete another user's reaction
- Non-member cannot read reactions

---

## V2 Notes

**Flag access control** — defer to v2:
- Per-member toggle: `memberships.can_flag boolean DEFAULT false` — coordinator sets in Team Admin
- Org-wide role default: `organizations.flag_roles text[] DEFAULT '{coordinator}'` — coordinator picks which roles can flag
- Mobile reads effective permission: `can_flag OR role IN org.flag_roles`
