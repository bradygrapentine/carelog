# Carelog — Product Roadmap

> **Status as of 2026-05-10:** Phases 1–5 substantially shipped. Phase 6 (launch readiness) is the active phase — most engineering is done; remaining work is human-gated (DNS, Sentry env, BAA, App Store submission). Open polish/a11y/observability follow-ups are tracked in `BACKLOG.md` §1. Source of truth audit: `docs/audits/2026-05-10-state-and-gaps.md`.

## Guiding principle

Build sequence follows retention value, not technical complexity.
The spine (journal + team + digest) must work before adding depth.
Depth before breadth. Every feature must answer: does this make a family
who is already using the platform more likely to stay?

## Phase 1 — The spine (shipped)

Goal: a family can coordinate daily caregiving without email or group text.

### Care journal (shipped)
The emotional core of the platform. A caregiver writes how today went.
The family reads it. The supporter reacts. The doctor reviews flagged entries.

Design decisions:
- `entry_kind: 'human' | 'system'` — human entries are prominent, system events are compact
- Mood tags (good/okay/difficult/crisis) — not just logging, emotional context
- "Share how today went" — language frames it as sharing, not reporting
- Flag for doctor — entries can be marked, then exported as a structured health summary

### Team coordinator (shipped)
One coordinator invites the full care team. Each person gets the right access level.

Roles:
- **Coordinator** — full access, invites others, manages settings
- **Caregiver** — reads + writes journal, logs medications and shifts
- **Supporter** — reads journal, can react, gets weekly digest, can't write
- **Aide** — professional caregiver, scoped to their assigned recipient

Design decision: recipient_id on memberships is nullable.
- NULL = org-wide coordinator (sees all recipients in the org)
- Value = recipient-scoped role (an aide assigned to a specific client)

This enables the agency model — a home care agency can have one org with
multiple care recipients and aides scoped to specific clients.

### Weekly digest (shipped — see ON-50, ON-59, LAUNCH-004 / TD-74)
Lives at `apps/web/inngest/functions/weeklyDigest.ts`. Every Sunday, supporters and coordinators get a summary of the week. What happened, how the care recipient is doing, whether anyone needs help.

This is the retention mechanism. Supporters who get a weekly digest
stay engaged. Engaged supporters send more reactions. Reactions keep caregivers
logging. The digest is a flywheel.

Technical design:
- Inngest cron job, runs Sunday morning
- `digestMinuteOffset(orgId)` — stagger sends over 4-hour window to avoid Resend rate limits
- `getWeekStamp()` + `idempotency_key` — prevents duplicate sends if job retries
- Content: top journal entries, mood trend, medications adherence, upcoming shifts

## Phase 2 — Scheduler (shipped)

Goal: a mixed care team (family + professional aides) can coordinate who's there when.

### Shift management (shipped)
- Create a shift with start/end time and optional assignee
- Recurring shifts (weekly pattern)
- Aide can claim an open shift
- Shift completion triggers a care event + handoff note prompt

Lives at `apps/web/app/(app)/journal/[recipientId]/{ShiftsPanel,ShiftList,ShiftForm}.tsx` with the `shifts` tRPC router and `ShiftCalendar` (react-big-calendar). ShiftsPanel hosts six layout tabs (Handoff / Week / Team / Questions / Calendar / Lanes / Now).

### Coverage request board (shipped)
When a caregiver can't make a shift, they post a coverage request.
Other team members see it and can claim it. The gap detector alerts
the coordinator when a coverage window has no assigned caregiver.

Design decision: `coverage_windows` table is separate from `shifts`.
Gap detection runs on coverage_windows, not shifts. This decouples
"what we scheduled" from "what was actually covered."

Migration: `supabase/migrations/20260409000000_coverage_windows_extend.sql`. Shift trade flow: `apps/web/server/repositories/shiftTradeRequestsRepository.ts` (test coverage tracked as TD-115).

### Handoff notes (shipped)
When a shift ends, the outgoing caregiver writes a handoff note.
The incoming caregiver sees it before they start. Goes into the care_events log.

Migration: `supabase/migrations/20260508000000_shifts_handoff_entries.sql`. UI: `NarrativeHandoff` component inside ShiftsPanel "Handoff" tab.

## Phase 3 — Medical (shipped)

Goal: the platform becomes the medication truth for the care team.

### Medication catalog (shipped)
Normalized medications table — not jsonb in care_events.
Each medication has a schedule. Each scheduled dose that was given/missed
creates a care_event. This makes missed dose detection clean:
`SELECT * FROM medications WHERE supply_days_remaining <= 7`.

UI: `MedicationPanel` + `MedicationChecklist` on the journal route. Tagging tied to events via `medicationTaggingRepository.ts` (test coverage tracked as TD-114).

### Prescription label scanning (shipped)
Mobile camera → OCR pipeline → pre-filled medication form.
The caregiver confirms or corrects. Never auto-creates without human confirmation.

Pipeline: image → Supabase Storage → Inngest job → Apple Vision/Google ML Kit
→ LLM parse → `ocr_jobs` status: needs_review → caregiver confirms → medication created

Migrations: `20260413000100_ocr_jobs_category_created_by.sql`. Review UI: `apps/web/app/(app)/.../OcrReviewPanel.tsx` + `e2e/ocr-review.spec.ts`.

### Refill alerts (shipped)
Inngest background job that finds medications with `supply_days_remaining <= 7`.
Sends alert to coordinator + assigned caregiver with pharmacy contact pre-populated.
Idempotency key: `refill:{medication_id}:{week_stamp}`.

Lives at `apps/web/inngest/functions/refillAlert.ts`.

### Care brief (shipped)
A shareable point-in-time snapshot: name, DOB (gated), medications, allergies, diagnoses, preferences, emergency contacts. Generated once, stored as jsonb. Shared via signed URL. Used when transitioning to a new aide, doctor, or facility.

De-tokenization happens ONCE at generation time. The stored snapshot has real names. The vault is never accessed again at view time.

DOB is gated server-side via the brief's `includes` array — family-share briefs default to `["medications", "journal"]` (DOB redacted); clinician briefs can opt in by including `"dob"` (UX-045, PR #396). UI: `apps/web/app/brief/[shareToken]/BriefEditorial.tsx`.

### Outer circle volunteer board (shipped)
Lives at `/care/[shareToken]` with `OuterCirclePanel` on the coordinator side.
Friends and neighbors want to help but don't know how.
The coordinator posts a request ("meals needed this week, 3 slots").
Anyone with the share_token link can claim a slot — no account required.

Security: the share_token IS the access control. The URL never exposes
the care recipient's name or any identifying information.

## Phase 4 — Depth and retention (shipped)

Goal: features that make power users more powerful and reduce caregiver burnout.

### Symptom tracker (shipped)
Log pain level, mood, appetite, mobility, vitals.
Trend view shows the care recipient's status over time.
Flagged entries go to the doctor export.

UI: `apps/web/app/(app)/journal/[recipientId]/SymptomPanel.tsx` + `symptoms` tRPC router.

### Burnout tracker (shipped)
The caregiver's own wellbeing, not just the care recipient's.
Weekly check-in: how are YOU doing? Sleep, stress, support.
If scores trend bad, the platform surfaces respite resources.

This is the differentiator nobody else builds. CareZone didn't do it.
Caring Village doesn't do it. It's also the feature that makes caregivers
feel seen, which drives retention and word of mouth.

UI: `BurnoutCheckin` + `BurnoutOrgSummary`. Inngest alert at `apps/web/inngest/functions/burnoutAlert.ts`.

### Full history export (shipped)
PDF or structured data export of the entire care history.
Every journal entry, medication log, shift record, symptom reading.
Formatted for a doctor or new care facility.

This is also a trust feature — families who know they can export everything
are more likely to put everything in.

Lives at `apps/web/app/api/history/export/pdf/route.tsx`.

### Visit recorder (schema shipped, UI status TBD)
Record an audio note or transcribe a doctor's visit.
Whisper for transcription, Claude for structured extraction.
Goes into the care_events log tagged to the appointment.

Migration `20260501132708_visit_recordings.sql` shipped 2026-05-01. UI surface (web vs mobile-only) is currently being triaged in **UX-107** — see `BACKLOG.md` §1.

## Phase 5 — Financial and legal (shipped)

### Shared expense log (shipped)
Who paid for what. Medical supplies, medications, home modifications, aide hours.
Split view shows equitable distribution across family caregivers.

UI: `apps/web/app/(app)/journal/[recipientId]/ExpensePanel.tsx`.

### Benefits navigator (shipped)
What benefits is the care recipient eligible for?
Medicare, Medicaid, VA benefits, state programs.
Pre-filled based on what's already in the platform (diagnoses, age, location).

### Document vault (shipped)
HIPAA authorization, POA, advance directive, insurance cards, medication list.
Encrypted storage. Shared access with the full care team.

Lives at `/api/documents/upload` + `/api/documents/[documentId]/download`.

### End-of-life planner (shipped)
The conversation people put off until it's too late.
Advance directive, healthcare proxy, funeral preferences, legacy messages.

When this ships, the elder law attorney referral channel becomes dramatically
more valuable — they're the ones having this exact conversation with families.

UI: `EolPlanner` component. Tests: `apps/web/app/(app)/journal/[recipientId]/__tests__/EolPlanner.test.tsx`.

## Phase 6 — Launch readiness (in progress)

Most engineering work is shipped; the remaining items are predominantly human-gated (env vars, account signups, legal review).

### Mobile App Store launch (🧑 human-gated — LAUNCH-001)
Run an internal TestFlight cycle (minimum one week, three or more real-device testers) before submitting to App Store Review. Complete the App Store Connect listing: app description, keywords, localized screenshots at iPhone 6.7″ and 5.5″ sizes, and the iOS privacy nutrition label. Mirror the full listing on Google Play Console. Requires EAS production build and Apple Developer enrollment.

### EAS production build (LAUNCH-002)
Finalize `eas.json` production profile: set `channel: "production"`, a `runtimeVersion` policy (e.g. `"appVersion"`), and distribution type. Configure `expo-updates` OTA gating so only builds in the production channel receive over-the-air updates. Add `eas build --platform all --profile production` to the release runbook.

### Web go-live (shipped — LAUNCH-003)
OG/Twitter meta on all marketing pages, `sitemap.xml`, `robots.txt`, and `Organization` + `SoftwareApplication` JSON-LD on the landing page. Lives at `apps/web/app/{robots,sitemap}.ts` plus per-page `generateMetadata`.

### Observability (mostly shipped — LAUNCH-004)
- ✅ Sentry app wiring (`@sentry/nextjs` via `withSentryConfig`); source-map upload requires `SENTRY_AUTH_TOKEN` in Vercel — **TD-03 (🧑 needs human)**.
- ✅ Rate-limit 429 monitor: `apps/web/inngest/functions/rateLimit429Monitor.ts`.
- ✅ Weekly digest delivery monitoring (TD-74).
- ✅ E2E green-streak gate (TD-75).

### Compliance and legal (🧑 human-gated — LAUNCH-005)
Publish a privacy policy and Terms of Service at stable URLs linked from the signup flow and site footer. Obtain a Business Associate Agreement from Supabase (HIPAA) and from Resend if email bodies contain PHI. Document a data-retention and right-to-erasure runbook covering how to honor deletion requests within the required timeframe. Requires legal review.

### SEO discoverability (in-progress)
LAUNCH-003 shipped the table-stakes (OG/Twitter meta, sitemap, robots.txt, Organization + SoftwareApplication JSON-LD). The post-launch SEO push goes deeper: SEO-001/002/004 shipped via PR #386 (intent-shaped titles, FAQPage JSON-LD on `/contact` + `/pricing`, footer cross-links). SEO-003 (HowTo JSON-LD) deferred — `/carezone-alternative` was consolidated into `/about` via PRs #316/#317 and `/about` lacks step-by-step content the schema would describe. Remaining work: SEO-005 (Core Web Vitals tightening on `/`, `/pricing`, `/about`); SEO-006/007 (Google Search Console verification + cornerstone content at `/learn/*`) — both 🧑 human-gated. Tracked in BACKLOG.md §1.

## Beyond Phase 6 — open follow-ups

The product is shipped. Open work beyond launch readiness lives entirely in `BACKLOG.md`:
- **UX polish** (`UX-*` rows) — author-name surfacing, recipient-led titles, copy passes, empty-state polish.
- **Accessibility** (`A11Y-*` rows + the spike `TD-87`) — Lighthouse a11y path, mobile a11y sweeps under A11Y-006.
- **Tech debt + observability** (`TD-*` rows) — Tier-1/Tier-2 test coverage gaps (TD-113..116), skill-dedup phase 2 (TD-111).
- **Mobile parity** (`PP-*` rows) — Android visual QA pass (PP-009).
- **Roadmap-promised but-not-yet-needed** — coverage request board claim flow (ON-70), refill alert delivery polish (ON-71), full-history structured export (ON-74).

## Feature sequencing rationale

**Why journal before scheduler:**
The journal is used daily. The scheduler is used when setting up shifts.
Daily use drives retention. Retention drives referrals. Referrals drive growth.
Build the daily habit first.

**Why team coordinator before medication log:**
A single-person journal isn't the product. The product is coordination.
The moment a second person joins, the platform becomes genuinely valuable.
This is also what unlocks the first real test with a real family.

**Why scheduler before medications:**
Scheduling is the primary coordination friction. Families fight about
who's going to be there Thursday, not (usually) about who gave the medication.
Solve the bigger fight first.

**Why burnout tracker in Phase 4 not Phase 1:**
The burnout tracker requires data to be useful — mood trends, activity patterns.
It needs 2-3 months of data to show meaningful trends. Building it in Phase 4
means families who've been using the platform have the data to make it valuable.

**Why end-of-life planner last:**
It's emotionally the hardest feature to use and requires the most trust.
Families build that trust through the earlier features. By the time they're
ready to use the end-of-life planner, they already trust the platform with
everything else.

## What we will NOT build

- **Telehealth** — not our expertise, highly regulated, enormous liability
- **Clinical decision support** — same reasons
- **Social network** — CaringBridge does this, we coordinate
- **Marketplace** — not connecting families to aides for hire
- **Insurance billing** — belongs in the agency's software, not the family's

The temptation will be to add features that make the platform look more impressive
to investors. Resist it. Every feature that doesn't directly help a caregiver
coordinate care is a distraction from the people who need this.
