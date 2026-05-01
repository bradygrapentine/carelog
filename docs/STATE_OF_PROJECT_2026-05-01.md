# Carelog — State of the project · 2026-05-01

Snapshot taken at end of the 2026-04-30 → 2026-05-01 session that shipped TD-100 (journal pagination), Plan C (UX-061..064 wiring), and TD-106 (export.spec regression fix).

---

## Headline

**Carelog is feature-complete against `docs/project-info/product/ROADMAP.md` Phases 1–5 (minus one deferred Phase-4 feature) and most of Phase 6 launch readiness.** Remaining work is targeted hardening, UI polish, observability gating, and two human-gated launch chores (App Store + legal).

If you froze the feature surface today, you'd ship within a few engineer-days plus the human gates.

---

## §0 status board (post `/backlog-sync` 2026-05-01)

| Lifecycle | Count | Surface |
|---|---|---|
| 🟢 Ready | **22** | Hardening + polish + 1 launch coordinator |
| 🔎 In review | 0 | — |
| 🟡 Spike | 1 | UX-046 clinician-share surface |
| 🔴 Blocked | 0 | — |
| 🧊 Deferred | 9 | Visit recorder (ON-55/69), parked UX polish |
| 🧑 Needs human | 8 | Launch gates, env vars, accessibility audit |
| ✅ Shipped (cumulative) | **108+ rows** | Across PRs #100–#344 |

Roughly 73% of currently-tracked story rows are in §7 Shipped. The Ready bucket is **all hardening and polish** — no roadmap features left in it.

---

## Roadmap phase completion

| Phase | Roadmap goal | Status | Notes |
|---|---|---|---|
| **Phase 1 — Spine** | Care journal + team coordinator + weekly digest | ✅ **Complete** | `weeklyDigest` Inngest function ships meds/journal/mood/shifts sections. Journal entries support mood, flag-for-doctor, comments, reactions, optimistic updates, offline queue, cursor pagination (TD-100). |
| **Phase 2 — Scheduler** | Shifts + coverage windows + handoff notes | ✅ **Complete** | P2-01..07 all shipped. UX-062 added Calendar / Lanes / Now toggle. UX-19 "What did I miss?" handoff modal exists. |
| **Phase 3 — Medical** | Med catalog + OCR + refill alerts + outer circle + care brief | ✅ **Complete** | OCR pipeline (Storage → Inngest → Apple Vision/ML Kit → LLM). Refill alerts (`refill:{med}:{week}` idempotency). Outer circle volunteer board with share-token security. Care brief de-tokenized snapshot. |
| **Phase 4 — Depth & retention** | Symptom + burnout + history export + visit recorder | 🟡 **Mostly complete** | Symptom tracker, burnout tracker, full history export all shipped. **Visit recorder deferred** (ON-55/69 in §5 Deferred — `expo-av` + Whisper + Claude pipeline; ~3 days). |
| **Phase 5 — Financial & legal** | Expenses + benefits navigator + document vault + EOL planner | ✅ **Complete** | All four modules shipped with PHI-safe storage. |
| **Phase 6 — Launch readiness** | Mobile / web / observability / legal | 🟡 **Mostly complete** | LAUNCH-002 (EAS profile), LAUNCH-003 (SEO/OG/sitemap) shipped. **LAUNCH-004 (observability) Ready, ~1 day.** LAUNCH-001 (App Store TestFlight) + LAUNCH-005 (legal/BAA) **human-gated.** |

**The 2026-04-30 CareSync 2.0 design wave** (UX-054..064) layered editorial typography + Sage palette + Now Board + Med adherence chart + Shifts layout toggle + Mood heatmap + Recipient profile route on top of the functional baseline. All shipped.

---

## UI completeness

Tracked via component test snapshots (216 web vitest files / 1698 passing tests) plus shipped UX-* rows. Every primary surface is built and exercised in component tests.

| Surface | State | Notes |
|---|---|---|
| Marketing landing (`/`) | ✅ Shipped, refined | UX-054 sage palette · UX-055 card variants · UX-016 Fraunces typography · landing-page-feedback-wave wave merged |
| Marketing /about /pricing /contact /for-referrers | ✅ Shipped | /compare + /carezone-alternative folded into /about (#316/#317) |
| Sign-in / OTP | ✅ Shipped | Mailpit local dev integration; PR #178 PostHog guard for missing keys |
| Onboarding | ✅ Shipped | Multi-step flow, recipient creation |
| Dashboard `(app)/dashboard` | ✅ Shipped | BriefHero · MedCard (now with day-strip + 7-day adherence chart from UX-061) · MoodCard sparkline · multi-recipient switcher · Now Board (UX-056) · view toggle |
| Journal `(app)/journal/[id]` | ✅ Shipped | Timeline with cursor pagination (TD-100) · prompted composer · mood spectrum · MoodHeatmap sidebar (UX-063) · ShiftsPanel toggle Calendar/Lanes/Now (UX-062) · Medications panel · Team panel · Documents · Symptoms · Expenses · Benefits · EOL planner · OCR review · Burnout check-in |
| Recipient profile `/recipient/[id]/profile` | ✅ Shipped (v1) | UX-064 server-component route resolves identity via `identityRepository`. Mood/caregivers/About are stubbed — see UX-066. |
| Visit summary | ✅ Shipped | Print-friendly UX-20 |
| AI Assistant FAB | ✅ Shipped | UX-15 quick-log; AI provider mounted globally |
| Care brief share `/care/[token]` | ✅ Shipped | Tokenized public page |
| Settings · Billing · Subscription · Education · History export | ✅ Shipped | Per-route error.tsx boundaries (TD-99) |
| Theme switcher | ✅ Shipped | UX-054 — Hearth (violet, default) / Sage / Slate · light/dark |
| Mobile app (`apps/mobile`) | ✅ Shipped | Expo Router; iOS/Android EAS build profile finalized (LAUNCH-002) |

The CareSync 2.0 visual layer (Sage parlor palette, editorial Fraunces typography, card header variants, Now Board, mood heatmap, recipient profile gradient) is in production for any user who toggles the theme switcher. **Hearth (violet) remains the default**; Sage is opt-in per user preference.

### UI polish backlog (UX-035, UX-041..045, UX-048..051, UX-053)

13 UX rows still Ready — these are *polish* not feature gaps:

- **UX-035** Gate BriefHero mock content behind a feature flag (it still ships hardcoded sample copy)
- **UX-041** Surface author identity on journal cards (multi-caregiver legibility)
- **UX-042** Journal top bar: show recipient name not org name
- **UX-043..045** Other journal multi-author affordances
- **UX-048..051** Misc surface refinements
- **UX-053** EmptyState consumers — every empty state should expose a primary action

None of these block feature completeness. Each is ~30 min – 2 hr.

---

## Test posture

| Suite | Count | Result |
|---|---|---|
| Web vitest (`cd apps/web && npx vitest run`) | 1698 passed / 4 skipped / 217 files | ✅ Green |
| Root monorepo vitest (`pnpm test`) | 173 passed | ✅ Green |
| RLS pgTAP (`supabase test db`) | 211 across 26 files (last counted 2026-04-25) | Not re-run this session |
| E2E Playwright (`pnpm exec playwright test`) | 176 specs · 36 pass · 5 fail · 10 skip · 125 unrun (bail-at-5) | Local environment failures: auth/sign-in-OTP, sign-out, billing-success error, care-brief public, dashboard-nav-from-journal. **All 5 root-cause to OTP / Mailpit / session-cookie chain — Inngest dev server (`npx inngest-cli dev -u …/api/inngest`) and Mailpit weren't running this session.** Not a project signal; CI runs them in a clean container with all services. CI E2E green post-TD-106. |
| TypeScript (`cd apps/web && npx tsc --noEmit`) | — | ✅ Clean |
| Lint | — | ✅ Clean (pre-commit hook enforces) |

The earlier silent E2E regression in `e2e/export.spec.ts` (toast text drift after TD-96) was diagnosed and fixed mid-session as **TD-106 / PR #343**, restoring the regression net.

---

## Remaining work — tabulated

### 🟢 Ready (22) — by category

**Hardening / coverage (8):**
- TD-03 — Sentry source maps upload (blocked on `SENTRY_AUTH_TOKEN` env in Vercel; LAUNCH-004 sub-item)
- TD-78..82 — Tier 1/2 server testing sweep (`user.ts`, `careEventsRepository`, `stripe.ts`, `organizationsRepository`, `care_events_client_id` migration RLS test)
- TD-87 — Restore Lighthouse a11y gating in CI (currently skips on Vercel preview auth)

**UX polish (12):**
- UX-035, UX-041..045, UX-048..051, UX-053 — see UI-polish backlog above
- UX-065 — BriefingHandoff narrative adapter (Plan C follow-up; `lib/handoffNarrative.ts`)
- UX-066 — RecipientProfile enrichment (mood / caregivers / About; PHI-sensitive)

**Platform (1):** PP-009

**Launch (1):** LAUNCH-004 — observability hardening (~1 day; coordinates TD-03/73/74/75)

### 🟡 Spike (1)
- UX-046 — clinician-share surface (design exploration)

### 🧑 Needs human (8)
- LAUNCH-001 — App Store TestFlight + listing
- LAUNCH-005 — Privacy policy / ToS / BAA / data-retention runbook
- ON-54 — (PHI consent flow)
- A2 / C3 / PP-008 — env / setup gates
- A11Y-018 — physical-device VoiceOver verification
- TD-83 — verify `CI Summary` is in main branch protection (UI-only; needs PAT)

### 🧊 Deferred (9)
- ON-55 / ON-69 — Visit recorder (Phase 4)
- UX-08/09/11/22/23/24 — parked UI polish from earlier waves
- PP-013 — (platform parity item)

---

## Estimated time-to-launch

Assuming the human gates run in parallel with engineering:

| Workstream | Estimate | Ownership |
|---|---|---|
| Tier 1/2 testing sweep (TD-78..82, TD-87) | 1.5 days | Eng |
| LAUNCH-004 observability hardening | 1 day | Eng |
| UX polish (UX-035, UX-041..045, UX-048..051, UX-053) | 1.5 days | Eng |
| UX-065 + UX-066 (Plan C follow-ups) | 1 day | Eng |
| Visit recorder (ON-55/69) — if shipping in v1 | 3 days | Eng |
| LAUNCH-001 App Store TestFlight cycle | ≥1 week elapsed | Human |
| LAUNCH-005 legal / BAA / privacy review | 1–3 weeks elapsed | Human |

**Without visit recorder: ~5 engineer-days + the longer human gate (~3 weeks calendar).**
**With visit recorder: ~8 engineer-days.**

The critical path is the human-gated work, not the engineering.

---

## What I'd actually flag

1. **Visit recorder was deferred** to ON-55/69 but is in the roadmap as Phase-4. Decide explicitly whether it's a v1 launch feature or post-launch — currently it's parked, which is fine as a decision but should be intentional.
2. **UX-046 spike** has been open as 🟡 — clinician-share surface design hasn't converged. If clinical sharing isn't a v1 feature, defer it to 🧊 to reduce in-flight cognitive load.
3. **LAUNCH-004 is the only Ready engineering blocker for launch** — TD-03 + TD-73 + TD-74 + TD-75 already have most of the wiring; coordinator-level work to close it.
4. **Mergify lets unstable PRs through** — observed behavior this session. If that policy is intentional, fine. If not, the queue config should require `mergeStateStatus = CLEAN` before queueing.
5. **177 cumulative shipped stories with 22 Ready** — backlog hygiene is working. `/backlog-sync` is the correct cadence.

---

## Source references

- `BACKLOG.md` §0 status board, §7 shipped log
- `docs/project-info/product/ROADMAP.md`
- `apps/web/CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/ui-standards.md`
- `apps/web/components/dashboard/MedCard.tsx` + `apps/web/components/medications/{MedScheduleStrip,AdherenceChart}.tsx` (UX-061)
- `apps/web/app/(app)/journal/[recipientId]/{ShiftsPanel,JournalLayout}.tsx` (UX-062, UX-063)
- `apps/web/app/(app)/recipient/[recipientId]/profile/page.tsx` (UX-064)
- `apps/web/lib/{medAdherenceFromEvents,shiftLayouts}.ts` (UX-061, UX-062 adapters)
- `apps/web/inngest/` weeklyDigest, refill alerts, digest delivery monitoring
- This session's PRs: #335 #336 #337 #338 #339 #340 #341 #342 #343 #344
