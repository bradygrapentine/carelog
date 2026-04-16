# Shift Calendar — Design Spec

**Date:** 2026-04-15
**Status:** Draft — awaiting implementation plan
**Scope:** Web app scheduling page. Mobile parity deferred to v2.

---

## Overview

Replace the current list view on the scheduling page with a calendar-first layout using `react-big-calendar`. Day, week, and month views are available via a view switcher. Shift events are color-coded by status. Clicking an event opens a detail popover; clicking an empty slot pre-fills the new shift form with that date/time. No new tRPC procedures or DB changes required.

---

## Library

**`react-big-calendar`** with `date-fns` localizer (already in the project). Provides day/week/month views out of the box with full custom event rendering support.

---

## Views

| View | Default | Description |
|---|---|---|
| Week | ✓ | 7-day time-slot grid — primary view |
| Day | — | Single-day time-slot grid |
| Month | — | Full month grid with event chips |

View + current date persisted as URL search params: `/schedule?view=week&date=2026-04-15`. Shareable, bookmarkable, browser back/forward works.

---

## Shift → Calendar Event Mapping

```ts
type CalendarEvent = {
  title: string        // assignee display name, or "Unassigned"
  start: Date          // shift.start_time
  end: Date            // shift.end_time
  resource: Shift      // full shift object — used by popover
}
```

Populated from the existing `shifts.list` tRPC query. No new procedures needed.

---

## Event States

| Status | Color | Token |
|---|---|---|
| Assigned | Purple | `var(--color-primary)` left border + `var(--color-primary-subtle)` bg |
| Unassigned (gap) | Red | `var(--color-danger)` left border + red-50 bg |
| Pending trade | Amber | `var(--color-secondary)` left border + `var(--color-secondary-subtle)` bg |

> Implementation note: verify exact status values against the `shifts` table schema before mapping. Add/remove rows above to match actual enum values.

`eventPropGetter` returns a CSS class per status; Tailwind applies the token-based colors. No raw hex.

---

## Interactions

| Action | Behavior |
|---|---|
| Click assigned/confirmed event | Opens `ShiftPopover` — shows assignee, time, status. Coordinator sees Edit / Delete buttons. |
| Click unassigned event | Opens `ShiftPopover` — highlights gap, shows "Assign shift" CTA. |
| Click empty time slot | Opens new shift form (`ShiftCreateDialog`) pre-filled with clicked date + time. |
| View switcher (Day / Week / Month) | Updates URL param `?view=`. Calendar re-renders. |
| Prev / Next arrows | Navigates by one unit of the current view. Updates URL param `?date=`. |
| Today button | Jumps to current date, preserves current view. |

---

## New Components

### `ShiftCalendar`
Main calendar wrapper. Wraps `react-big-calendar`, feeds events from `shifts.list`, manages view + date state via URL params (`useSearchParams`). Renders inside the existing scheduling page layout.

### `ShiftEventCard`
Custom event renderer passed to RBC's `components.event`. Shows assignee name and time range. Status-based className applied via `eventPropGetter`.

### `ShiftPopover`
Click-to-view detail panel. Uses shadcn `Popover`. Shows: assignee name, shift time, status badge. Coordinator-only: Edit button (opens existing edit form), Delete button (with confirmation). Non-coordinators see read-only view.

---

## CSS / Design Tokens

react-big-calendar ships its own stylesheet. Override in `apps/web/app/globals.css`:

- Today highlight → `var(--color-primary-subtle)`
- Font family → `var(--font-sans)`
- Border color → `var(--color-border)`
- Header text → `var(--color-ink)`
- Event rendering → delegated to `ShiftEventCard` (full token control)

Import RBC's base CSS once in the scheduling page or root layout: `import 'react-big-calendar/lib/css/react-big-calendar.css'`

---

## What Doesn't Change

- Shift creation form — unchanged, reused via `ShiftCreateDialog`
- Shift edit form — unchanged, opened from `ShiftPopover`
- Existing `shifts.*` tRPC router — no new procedures
- RLS policies — no changes
- No new DB tables or migrations

---

## Testing

### Vitest (unit)
- Shift → `CalendarEvent` mapping: assigned, unassigned, pending trade each produce correct `title` and `resource`
- Status → CSS class mapping: each status returns the correct class
- URL param parsing: `view` and `date` round-trip correctly

### Playwright (E2E) — `e2e/shift-calendar.spec.ts`
- `/schedule` renders calendar in week view by default
- View switcher: clicking Day / Week / Month renders without error and updates URL
- Clicking a shift event opens `ShiftPopover` with correct assignee name
- Clicking an empty slot opens the new shift form with date/time pre-filled
- Unassigned shift event has the red danger class applied

---

## Out of Scope (v1)

- Drag-and-drop shift reassignment (FullCalendar upgrade path)
- Resource view (one row per caregiver)
- Mobile calendar (deferred to v2)
- iCal / Google Calendar export
