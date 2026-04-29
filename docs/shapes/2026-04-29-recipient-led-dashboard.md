# Shape: Recipient-led dashboard (UX-039)

**Date:** 2026-04-29
**Status:** Confirmed brief — ready for implementation
**Origin:** `/impeccable critique` of caregiver dashboard, 2026-04-29
**Backlog row:** UX-039

---

## Problem

The dashboard scored 1/4 on "Recipient-as-person" against PRODUCT.md Principle 4
("the recipient is a person, not a chart"). It currently leads with the heading
"Your care teams" and a two-letter org-name initials chip ("JO" for "Johnson
Family"). The actual person being cared for — Margaret, Eleanor, Robert — is
named nowhere on the dashboard. The most exhausted version of the user opens the
app and reads two uppercase letters and an event count, not a name or a face.

In addition:

- BriefHero — the strongest hand-off surface in the product — sits below the
  team selector. The first thing a returning caregiver sees is admin chrome,
  not "what happened with Mom today."
- `ReferralCard` (an acquisition mechanic) renders below the medication card on
  the primary care surface. Wrong job-to-be-done.

## Direction (confirmed)

**Hybrid — A by default, B opt-in for multi-recipient households.**

- **N = 1 recipient.** Always layout A (single-focused). No switcher needed.
- **N > 1 recipients.** Layout A by default with a recipient switcher chip;
  user can toggle to layout B (stacked-by-recipient view) via a "Show all
  recipients" toggle. Toggle state persists per-user (localStorage is fine
  for v1; promote to a `user_preferences.dashboard_view` column if/when other
  prefs accumulate).

### Layout A — Single-focused

```
┌──────────────────────────────────────────────────────────┐
│  Caring for Margaret                       [N>1: ▾ switcher]
│  (Fraunces 32–40px, .headline-display)
│
│  ┌─ BriefHero ──────────────────────────────────────┐
│  │  TODAY'S BRIEF · auto-generated 7:02a            │
│  │  Mom slept poorly. Three med doses missed.       │
│  │  [pills: 2 medications tracked, feeling difficult, ...]
│  └──────────────────────────────────────────────────┘
│
│  ┌─ MedCard ─────────┐  ┌─ MoodCard ──────────────┐
│  │ Today's meds      │  │ Mood (13 days)          │
│  └───────────────────┘  └─────────────────────────┘
│
│  [Visit summary]   [Open care journal →]
└──────────────────────────────────────────────────────────┘

(ReferralCard NOT rendered here. Lives in Settings.)
```

### Layout B — Stacked-by-recipient (multi-recipient, opt-in)

```
┌──────────────────────────────────────────────────────────┐
│  Your care recipients                       [▴ Single view]
│
│  ┌─ Margaret ──────────────────────────────────────┐
│  │  Caring for Margaret (.headline-display)
│  │  Brief excerpt (1–2 lines)
│  │  [meds 2 of 4 done · mood difficult · 3 notes]
│  │  [Open Margaret's journal →]
│  └──────────────────────────────────────────────────┘
│
│  ┌─ Robert ────────────────────────────────────────┐
│  │  Caring for Robert (.headline-display)
│  │  Brief excerpt (1–2 lines)
│  │  [meds quiet · mood stable · 1 note]
│  │  [Open Robert's journal →]
│  └──────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

Each recipient block in B is a compact summary; tapping the heading or the
"Open journal" CTA navigates into the per-recipient full surface.

### Recipient name display style

`.headline-display` Fraunces 32–40px (the existing editorial class). Pattern:

```tsx
<h1 className="headline-display text-[clamp(2rem,4vw,2.5rem)]">
  Caring for <em>{firstName}</em>
</h1>
```

The `<em>` makes the recipient's name carry the load-bearing italic emphasis
(weight 300, Lamplight Violet, per the Italic-Emphasis Rule). The recipient's
name IS the editorial subject of the page, so it earns the emphasis.

Avatar (small, 24–28px) sits inline before the headline using the recipient's
initials (not the org's). Tinted background follows the existing avatar pattern.

### ReferralCard destination

**Settings** under a new "Grow CareSync" group. Decision point — could equally
go in Team Admin if framed as a coordinator-only org-management action. Picked
Settings because:

- Settings is where users go to manage *their* relationship with the product;
  referral is a personal share action.
- Team Admin already has a focused surface (members, roles, invites) — adding
  a non-membership action there muddies that.
- Settings supports `isCoordinator` gating just as cleanly via a section that
  only renders for coordinators.

**Reversible decision** — if onboarding telemetry shows referral conversions
drop more than expected after the move, revisit. Capture the metric (referral
landing page hits / referral CTA clicks) before and after the move.

## Scope

### In scope

1. **Recipient name fetch on dashboard.** Add `care_recipients.name` to the
   query in `DashboardClient.tsx:215–218`. Pass to the BriefHero region.
2. **Layout A heading + avatar.** Replace the "Your care teams" heading + org
   initials chip with the recipient-name `.headline-display` heading + small
   recipient-initials avatar.
3. **Promote BriefHero.** Move BriefHero above the team selector. The team
   selector becomes a smaller chip / dropdown control above the heading (or
   absorbs into the avatar if N > 1).
4. **Layout B render path.** When N > 1 AND user has toggled "Show all
   recipients", render the stacked layout. Each recipient block calls a
   new `useRecipientSummary(recipientId)` hook (or accepts pre-fetched data)
   to populate brief excerpt + counts.
5. **Toggle control.** Small toggle button visible only when N > 1. Persists
   to `localStorage['caresync.dashboardView']` with values
   `'single' | 'stacked'`.
6. **Move ReferralCard to Settings.** Delete from
   `DashboardClient.tsx:518–519`. Add a new "Grow CareSync" section in
   `apps/web/app/(app)/settings/page.tsx` (gated on `isCoordinator`).

### Out of scope (later)

- A `user_preferences.dashboard_view` DB column (localStorage suffices for v1).
- Per-recipient deep-linking via URL state (`?recipient=margaret`). Defer
  unless someone asks; querystring gives no benefit until we share dashboard
  views.
- Animated transition between layout A and B. The toggle can hard-flip; no
  motion polish in v1.
- Refactoring `BriefHero` itself. The component already does what we need;
  this is a layout move, not a brief-content change.

## Files affected

- `apps/web/app/(app)/dashboard/DashboardClient.tsx` (the bulk of the work)
- `apps/web/app/(app)/dashboard/page.tsx` (if data fetching changes shape)
- `apps/web/app/(app)/settings/page.tsx` (new "Grow CareSync" section)
- Potentially a new `apps/web/components/dashboard/RecipientHeading.tsx`
  (extracted heading + avatar component)
- Potentially a new `apps/web/components/dashboard/RecipientSummaryCard.tsx`
  (the per-recipient block in layout B)
- Potentially a new `apps/web/lib/dashboard/useRecipientSummary.ts` hook
  for layout B's per-recipient data

Tests:

- `DashboardClient.test.tsx` — update assertions to match the new heading
- `RecipientHeading.test.tsx` (new) — renders name + avatar; emphasis class
  is applied; works with single-word and long names
- `RecipientSummaryCard.test.tsx` (new) — renders compact summary for
  multi-recipient B layout
- Move/update any existing `ReferralCard` integration tests that assumed
  dashboard mounting

## Acceptance criteria

- [ ] Page heading reads "Caring for {firstName}" using `.headline-display`
      with recipient name in `<em>`
- [ ] Recipient initials avatar sits inline before the heading (not org
      initials)
- [ ] BriefHero is the first content block below the heading on layout A
- [ ] When user has > 1 recipient: a "Show all recipients" toggle is visible;
      flipping it switches to layout B; choice persists across reloads
- [ ] Layout B renders each recipient as a named summary card with brief
      excerpt + meds/mood/notes counts
- [ ] `ReferralCard` no longer renders on the dashboard
- [ ] `ReferralCard` renders in Settings under "Grow CareSync" for
      coordinators only
- [ ] No regressions on existing dashboard tests (1451 baseline)
- [ ] Mobile: heading reflows at 320px without horizontal scroll
- [ ] WCAG AA contrast holds on Fraunces emphasis at the new size

## Risks

- **Avatar visual weight.** A small avatar inline with `.headline-display`
  could feel cluttered. If it doesn't read clean in implementation, drop the
  avatar and let the name carry alone.
- **Switcher placement (multi-recipient A).** A dropdown to switch between
  recipients in single-focused mode might compete with the toggle to flip to
  layout B. Resolve in implementation: if both controls are needed, group them
  into one "viewing Margaret · ▾" affordance.
- **Brief excerpt in layout B.** The `BriefHero` component renders a full
  card; layout B needs a compact one-line excerpt. Either factor a
  `<BriefSummary mode="compact" />` variant, or render a plain
  `<BriefHeadline />` (the existing structured component) without its outer
  card chrome. Prefer the latter — keeps the API minimal.

## Estimate

~1–1.5 days for a single Sonnet subagent in a focused worktree. Layout A is
the larger lift (heading, avatar, BriefHero promotion, ReferralCard removal,
Settings move). Layout B + toggle is smaller (~3 hours) once A is in place.

Could split into two PRs:
- **PR 1 (UX-039a):** Layout A + ReferralCard move. Delivers the 80% value.
- **PR 2 (UX-039b):** Layout B + toggle. Multi-recipient affordance.

Recommended: ship as two PRs. PR 1 closes the core PRODUCT.md violation
immediately; PR 2 follows when the layout-A footprint is stable and we can
see how the multi-recipient case actually feels on a real account.
