# Plan B — Web hardening sweep

## Goal

Tighten the web app's resilience to long content, slow networks, screen-reader users, and i18n drift. Each track is bounded and file-disjoint.

## Source rows (BACKLOG.md §1)

- **TD-98** Text overflow / truncation pass on cards
- **TD-100** Journal timeline cursor pagination + virtualization
- **TD-101** RTL smoke test
- **TD-102** `mutations.retry: 0` in TrpcProvider
- **TD-103** Debounce journal + messages search inputs
- **TD-104** `pluralize(count, singular, plural)` helper
- **A11Y-019** SR-only live region for offline-queue + optimistic-update transitions

## Tracks

| ID | Files (exclusive) | Owner | Notes |
|---|---|---|---|
| B1 / TD-98 | `apps/web/components/dashboard/MedCard.tsx`, `RecipientHeader.tsx`, `ShiftEventCard.tsx`, `JournalTimeline.tsx` (truncate / min-w-0 sweep + 60-char fixture in tests) | Sonnet | Add `min-w-0 truncate` (or 2-line clamp) to every flex-1 long-text site. |
| B2 / TD-100 | `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx` + new `useJournalCursor` hook + tRPC procedure tweak | **Opus** | Schema-aware (cursor pagination on care_events). |
| B3 / TD-101 | `apps/web/components/dashboard/__tests__/RtlSmoke.test.tsx` (new); maybe minor `globals.css` fix | Sonnet | Render `/dashboard` with `dir="rtl"`, screenshot diff or assertion-based. |
| B4 / TD-102 | `apps/web/components/providers/TrpcProvider.tsx` + tests | Haiku | Set `mutations.retry: 0`; document explicit retry buttons. |
| B5 / TD-103 | `apps/web/hooks/useDebouncedValue.ts` (new) + JournalTimeline + Messages search wiring | Sonnet | 200ms debounce. Pure helper + 2 wiring sites. |
| B6 / TD-104 | `apps/web/lib/pluralize.ts` (new) + 5–10 site migration | Haiku | `Intl.PluralRules` + thin string fallback. |
| B7 / A11Y-019 | `apps/web/components/a11y/LiveRegion.tsx` (new) + offline-queue subscription wiring | **Opus** | Schema-aware + offline-queue cross-cutting concern. |

## Sequencing

- All tracks file-disjoint with one exception: B1 + B5 both touch JournalTimeline. Order them: B5 first (debounce wiring at top), then B1 (truncation on per-row text). Or carve B1's JournalTimeline edits into a separate slice.
- Opus owns B2 (schema), B7 (offline-queue cross-cut). Subagents take B1, B3, B5; Haiku takes B4 + B6.

## Definition of done

- B1: 60+ char fixture in MedCard / Recipient / Shift event tests; no horizontal overflow at 320px.
- B2: client-side render at 200-entry threshold; cursor-based fetch verified end-to-end with vitest + a Playwright smoke.
- B3: `dir="rtl"` smoke test that loads `/dashboard` and verifies no overlap or out-of-flow elements.
- B4: tRPC mutations no longer auto-retry; offline-queue still works.
- B5: keystroke ≥ filter render is debounced; existing filter behavior unchanged.
- B6: `pluralize(1, "entry", "entries") === "1 entry"` etc.; 5+ migrated sites.
- B7: SR-only live region announces "logged" / "queued offline" / "synced" / "rollback" — verified via @testing-library/jest-dom `aria-live` assertions.

## Verify before merging each track

- `cd apps/web && npx tsc --noEmit` clean
- `cd apps/web && npx vitest run` full suite green
- For B7: optional axe assertion (browser project allowing) — else native ARIA-attribute assertions, per the pattern UX-059 used.
