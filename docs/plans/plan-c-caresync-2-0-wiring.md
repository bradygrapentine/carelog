# Plan C — CareSync 2.0 wiring follow-ups

## Goal

The 7 PRs in the CareSync 2.0 batch (UX-054..UX-060) intentionally shipped pure-presentational primitives. This plan mounts them into their real surfaces and closes the design-spec loop.

## New BACKLOG rows (added in the same chore PR as these plans)

- **UX-061** Wire MedScheduleStrip + AdherenceChart into MedCard
- **UX-062** Mount Shifts BriefingHandoff + ShiftLanes + TeamNowBoard on the shifts route
- **UX-063** Mount MoodHeatmap into JournalLayout sidebar
- **UX-064** Mount RecipientProfile on the recipient route

## Tracks

| ID | Files (exclusive) | Owner | Notes |
|---|---|---|---|
| C1 / UX-061 | `apps/web/components/dashboard/MedCard.tsx` + tests; new `lib/medAdherenceFromEvents.ts` adapter | **Opus** | Schema-aware: derive `AdherenceDay[]` from `care_events` + medication_schedules. Reuse existing `lib/medAdherence.ts`. |
| C2 / UX-062 | `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx` (or wherever shifts live — verify path), new shift-route view component | **Opus** | Tabs / segmented control to switch among Briefing / Lanes / Now-board layouts. |
| C3 / UX-063 | `apps/web/app/(app)/journal/[recipientId]/JournalLayout.tsx` (sidebar slot) + tests | Sonnet | Wrap MoodHeatmap; pass last-5-week mood data from existing tRPC. |
| C4 / UX-064 | New route segment or panel surfacing `<RecipientProfile>` with PHI from `identityRepository.resolveIdentity` server-side | **Opus** | PHI-sensitive — Opus owns. Decide: separate `/recipient/[id]/profile` page vs. tab in journal route. |

## Sequencing

- C1 + C3 are file-disjoint and small → run in parallel.
- C2 + C4 each have IA decisions (where the new surface lives). Either:
  - Pre-decide IA in a 1-paragraph sub-spec at the top of each PR (Opus), OR
  - Block both behind a 5-min user check-in.
- Recommend: pre-decide; user can redirect on PR review.

## Definition of done

- C1: MedCard renders the day-strip + 7-day chart from real data on the live dashboard. Loading skeleton + empty-state preserved.
- C2: Shifts route exposes all three layouts via a toggle. No regressions to existing ShiftCalendar / HandoffSummary modal.
- C3: Sidebar shows the 5-week heatmap, color-coded per mood; keyboard-traversable.
- C4: Recipient profile renders on a discoverable surface, identity values resolved through `resolveIdentity` (no raw `identity_vault` queries from the client).

## Verify before merging each track

- `cd apps/web && npx tsc --noEmit` clean
- `cd apps/web && npx vitest run` full suite green
- For C4: PHI-rule sweep — no analytics call carries name / email / DOB / phone.
- Visual: sanity-check each surface in a browser (light + dark, sage + violet).

## Out of scope

- Mobile parity (`apps/mobile`). All four surfaces stay web-only for v1.
