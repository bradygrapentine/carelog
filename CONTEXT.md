# Carelog

Carelog coordinates distributed family caregiving for a shared **Care Recipient** — logging activities, tracking mood and medications, scheduling shifts, and managing benefits and expenses across an **Organization** of caregivers.

## Language

### People & roles

**Care Recipient**:
The person receiving care, scoped to one **Organization**. The subject of every **Care Event**, **Shift**, **Care Brief**, and **Expense**.
_Avoid_: patient (too clinical), loved one (informal, ambiguous)

**Caregiver**:
A **Membership** holder with the `caregiver` role. Authors **Care Events** and **Shifts** for the **Care Recipient**.

**Coordinator**:
A **Membership** holder with the `coordinator` role. Manages membership, sees aggregate **Burnout Check-In** trends, runs **Benefits Screening**, approves **Expenses**, controls **Care Brief** sharing.
_Avoid_: admin, owner (the schema role is `coordinator`)

**Supporter**:
A **Membership** holder with the `supporter` role — extended family or friends granted limited read access within the **Organization**.

**Aide**:
A **Membership** holder with the `aide` role — a professional or contracted caregiver, distinct from family `caregiver`.

**Outer Circle**:
A non-member granted read access to one **Care Brief** via a signed URL token (claim flow in `outer_circle_requests` / `outer_circle_claims`). Per-recipient scope; not a **Membership**.
_Avoid_: external sharer, guest

### Org boundary

**Organization**:
The data-isolation boundary. Every **Care Event**, **Shift**, **Expense**, and other recipient-scoped row belongs to exactly one **Organization**.
_Avoid_: family (the app supports non-family care networks), team, account

**Membership**:
A user's role-bearing relationship to an **Organization** — one of `coordinator`, `caregiver`, `supporter`, `aide`.
_Avoid_: invite (only the pre-accepted form), role assignment

### What gets logged

**Care Event**:
A row in `care_events` — one timestamped observation about a **Care Recipient**.
_Avoid_: journal entry, log entry, activity (all in active use; **Care Event** is canonical)

**Mood Entry**:
A daily 4-category observation (`good` / `okay` / `difficult` / `crisis`) about a **Care Recipient**'s emotional or behavioral state. A specialized **Care Event**.

**Symptom Reading**:
A row in `symptom_readings` — a quantitative or categorical observation of a clinical sign (e.g. blood pressure, pain level). PHI.

**Medication**:
A drug regimen attached to a **Care Recipient** — name, dose, schedule. **Care Events** record administration; **Medication** rows define the regimen itself. PHI.

**Burnout Check-In**:
A row in `burnout_checkins` capturing a **Caregiver**'s self-rated wellness — sleep, stress, support. Visible to the author and **Coordinators** only.
_Avoid_: wellness check, self-report

**Expense**:
A row in `expenses` — a care-related cost on the shared ledger. Append-only by **Caregivers**; deletable only by **Coordinators**.

**Document**:
A row in `documents` — a stored file attached to a **Care Recipient** (clinical record, legal form, photo). Referenced by **Care Briefs**.

### Schedules & summaries

**Shift**:
A scheduled care window assigned to one **Caregiver** for one **Care Recipient** in a specific time block. Carries coverage indicators and handoff notes.

**Care Brief**:
A curated, tokenized snapshot of a **Care Recipient**'s current state — meds, recent mood, key **Documents**, history. The artifact shared with the **Outer Circle**.
_Avoid_: snapshot (marketing alias only), summary

**Weekly Digest**:
The Inngest-scheduled function that emails each active **Membership** a weekly recap — new meds, journal highlights, mood trend, upcoming **Shifts**.
_Avoid_: weekly summary, recap

### Programs & planning

**Benefits Screening**:
A **Coordinator**-run questionnaire that assesses a **Care Recipient**'s eligibility for government and social programs. Results stored as JSONB.
_Avoid_: eligibility check, intake form

**EOL Plan**:
A row in `eol_plans` — end-of-life preferences for a **Care Recipient** (DNR status, advance directives, funeral wishes). Coordinator-controlled.

**Visit Summary**:
A print-friendly transcript artifact summarizing a clinical visit — attached to a **Care Recipient**. Distinct from **Visit Recorder** (deferred audio-to-notes feature).

## Relationships

- An **Organization** has many **Memberships** (1:N).
- An **Organization** owns one or more **Care Recipients** (1:N); RLS enforces cross-org isolation.
- A **Care Recipient** has many **Care Events** (1:N); each **Care Event** is authored by one **Caregiver** (N:1).
- A **Mood Entry** is a specialized **Care Event**; a **Symptom Reading** is a separate row type with stricter PHI handling.
- A **Caregiver** authors their own **Burnout Check-Ins**; **Coordinators** see aggregates only.
- A **Shift** is assigned to one **Caregiver** for one **Care Recipient** within one **Organization**.
- A **Care Brief** is shared with the **Outer Circle** via signed URL token, not via **Membership**; scope is per-recipient.
- A **Care Brief** references zero or more **Documents**.
- An **Expense** belongs to one **Care Recipient**, appended by any **Caregiver**, deletable only by a **Coordinator**.

## Example dialogue

> **Dev:** "When a **Caregiver** logs a difficult **Mood Entry**, does that show up in the **Weekly Digest**?"
> **Domain expert:** "Yes — **Mood Entries** are **Care Events**, so the digest pulls them. A **Burnout Check-In** wouldn't, even though it's also a 1–5 score, because that's the caregiver's *own* wellness, not the **Care Recipient**'s. **Coordinators** see burnout aggregates separately; the digest is care-recipient-scoped."
> **Dev:** "Could a **Caregiver**'s sister see that digest?"
> **Domain expert:** "Not unless she's a **Membership** holder. The **Outer Circle** gets a **Care Brief** link — read-only, one recipient — never the digest."

## Flagged ambiguities

- **"Care Event" vs "journal entry" vs "activity"** — All three appear in code, docs, and migrations. Resolved: **Care Event** is canonical (matches the `care_events` table). "Journal" is acceptable in user-facing copy; "activity" is retired.
- **"Care Recipient" vs "patient" vs "loved one"** — Resolved: **Care Recipient**. "Patient" is too clinical, "loved one" too informal.
- **"Care Brief" vs "snapshot"** — Marketing uses "snapshot"; code and product use "brief." Resolved: **Care Brief** in code and docs; "snapshot" is marketing-only.
- **PHI fields** — **Mood Entry**, **Symptom Reading**, and **Medication** rows hold PHI. Confirm governance docs flag these explicitly before any export, log sink, or analytics integration.
