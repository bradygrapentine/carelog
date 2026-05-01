# UX-046 — Clinician-readable share surface (spec)

**Type:** Spike → Spec · **Opened:** 2026-04-29 · **Speced:** 2026-05-01
**Status:** Recommendation. Founder/PM decision pending. No code yet.

---

## Problem

`PRODUCT.md` Principle 3 promises: *"a doctor's appointment starts with a real summary."* Today, no shipped surface delivers a clinician-readable artifact behind a shareable URL.

Three existing share-shaped surfaces, none of which fit:

| Surface | Audience | Auth | Content shape |
|---|---|---|---|
| `/care/[shareToken]` | Outer circle (friends/neighbors) | Token-only | Volunteer claim form for meals/errands. Carries no clinical content. |
| `/brief/[shareToken]` | Anyone with the URL | Token-only | Editorial Care Brief. Recipient name + recent journal entries + meds + flagged events. **Composed for family reading.** |
| `/visit-summary` | Logged-in coordinator/caregiver | Authenticated | Print-friendly clinical layout (meds, vitals SVG sparklines, symptoms, journal highlights, blank questions). **Print-only — must be physically delivered.** |

The "real summary for the doctor" promise has no path that's both clinically composed *and* shareable via URL.

---

## Decision: extend `/brief/[shareToken]` rather than build a new route

**Recommendation:** add a `mode` switch to the Care Brief that renders a clinical composition, and surface a "Email this to your doctor" CTA from `/visit-summary` that generates such a brief.

### Why not a new `/clinician/[shareToken]` route

1. **The token-URL pattern + PHI surface area already exists** at `/brief/[shareToken]`. A second token route doubles the audit footprint (rate limits, RLS scope, share-token revocation, token-rotation policy, public-page perf budget) for a content variation, not a security variation.
2. **The brief de-tokenization model already fits the clinical use case.** Per `ROADMAP.md` Phase 3, briefs do identity resolution *once at generation time* and store the snapshot — the vault is never accessed at view time. That's exactly what a clinician-facing artifact wants.
3. **A doctor receiving two different "shareable summary" links is confusing.** Coordinators already wrestle with which link does what; another one tightens the trap.

### Why not extend `/visit-summary` with a token URL

`/visit-summary` is intentionally an authenticated print surface. Adding a token-URL adapter means duplicating the entire layout into a public-component variant, plus a new rate-limit profile, plus token-revocation UX. That's effectively building option (a) inside option (c) — pick the lighter shape.

### Why not lean on the existing brief as-is

The existing brief is composed for family reading: lead with the day's mood narrative, soft headline (Fraunces italic), recent journal entries rendered as paragraphs. A doctor scanning before a 15-minute visit needs:

- **Meds**: full list with dose, schedule, recent adherence %, last refill date
- **Symptoms / vitals trend**: BP/HR/sleep/pain score deltas vs. last visit
- **Flagged entries**: chronological, with author + timestamp
- **Diagnoses + allergies + emergency contacts** — short and visible

That's a different composition, not a different route. The brief generator already has all this data — `recipients.diagnoses`, `medications`, `medication_schedules`, `care_events` (event_type='symptom' / 'medication' / 'journal' WHERE flagged=true). What's missing is the **composition mode**.

---

## Surface design

### Brief content modes

Add `mode` to the Brief generator + view:

```ts
type BriefMode = "family" | "clinical";
```

- **`family`** (default — what ships today): editorial Fraunces headline · daily-mood narrative · recent journal entries paragraph-rendered · meds list collapsed · flagged events as a small footer.
- **`clinical`**: clinical-typography headline (Geist, no italics) · recent vitals sparklines · meds table with dose / schedule / 7-day adherence % · symptom trend block · flagged journal entries listed chronologically (timestamps + authors visible) · diagnoses / allergies / emergency contacts as a sticky right-rail card.

Mode is captured at generation time and stored in `briefs.content.mode` so a re-render is deterministic.

### Generation entry points

Two CTAs:

1. **From `/visit-summary`** — "Email this to your doctor" button. Generates a `clinical`-mode brief, returns the share URL, and copies it to clipboard. The visit-summary print path stays exactly as it is.
2. **From the dashboard kebab on BriefHero** — "Share with doctor" item that always generates clinical-mode (as opposed to the existing "Share with family" which uses family-mode).

### Token + revocation

Reuses existing `briefs.share_token` UUID pattern. PHI rule per `PRODUCT.md`:

- The token IS the access control. URL never embeds the recipient's name.
- Brief content is de-tokenized once at generation and stored as JSON; the vault is not read at view time.
- Existing brief expiration policy applies — no new revocation surface needed for v1.

### Schema impact

One column add:

```sql
ALTER TABLE briefs ADD COLUMN mode TEXT NOT NULL DEFAULT 'family' CHECK (mode IN ('family', 'clinical'));
```

Defaults to `'family'` so existing briefs keep their current rendering. Migration is online-safe (NOT NULL with a DEFAULT on a small table).

### View-side switch

`apps/web/app/brief/[shareToken]/page.tsx` reads `brief.mode` and dispatches:

```tsx
{brief.mode === "clinical"
  ? <BriefClinical brief={brief} />
  : <BriefEditorial brief={brief} />}
```

`BriefClinical.tsx` is a new component — composes the clinical layout from existing pieces (`MedScheduleStrip`, `AdherenceChart`, `BriefHeadline`, the visit-summary's vitals sparklines lifted into a shared component).

---

## Out of scope (intentional)

- **HIPAA-portable export format (CCDA / FHIR)** — the doctor reads, doesn't import into their EHR. If FHIR export becomes a need, that's a separate feature with separate compliance scope.
- **Two-way Q&A** — doctor responding via the share link. The brief is one-way; questions are routed through the existing `/visit-summary` blank-questions section.
- **Doctor-side authentication** — clinicians don't make Carelog accounts. The token IS the credential.
- **Email delivery infrastructure** — "Email to your doctor" copies a URL to clipboard in v1. Sending mail from Carelog is a separate decision (Resend BAA → LAUNCH-005).

---

## Estimated effort

| Slice | Effort | Owner |
|---|---|---|
| 1. Migration: `briefs.mode` column + types regen | 0.5 hr | Eng |
| 2. `BriefClinical` component (lifts vitals + meds-adherence already in `MedScheduleStrip`/`AdherenceChart`) | 4 hr | Eng |
| 3. Brief generator: branch composition by mode | 2 hr | Eng |
| 4. Visit-summary CTA + dashboard "Share with doctor" item | 1.5 hr | Eng |
| 5. Tests (component + brief generator + RLS preserve) | 2 hr | Eng |

**Total: ~10 hr (~1.5 engineer-days).** Suggest filing as **UX-067 — Clinical-mode Care Brief** when the spike resolves.

---

## Open questions for founder/PM

1. **Default mode.** Should the dashboard kebab show "Share with family" first, or "Share with doctor"? `family` is what ships today; flipping the default is a UX decision.
2. **Visit-summary deprecation timeline.** If the clinical brief reaches parity, does `/visit-summary` retire, or does the print-friendly path stay for caregivers who don't want to share a URL? My recommendation: keep both — print and URL are different distribution channels.
3. **Token TTL.** Briefs currently don't expire. Clinical briefs may want a default 30-day TTL since they leak more PHI per artifact. Decide before shipping.

---

## Recommendation

**Adopt option (c) extended.** File the work as UX-067 once this spec is approved. The migration is small, the component lift reuses already-shipped UX-061 primitives (MedScheduleStrip + AdherenceChart), and one share-route reduces user confusion. New `/clinician/[shareToken]` rejected — duplicates the security surface for a content concern.
