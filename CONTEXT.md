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

---

## Appended 2026-05-14 — `/oop` Phase 1 mapping

### Identity & access

**Identity Token**:
An opaque UUID stored in `care_recipients.identity_token`. The real name lives only in `identity_vault` (service-role-only RLS) and is resolved to `display_name` at the server layer — never persisted on the client. Limits PHI exposure in browser/mobile state.

**Identity Vault**:
Service-role-only table holding encrypted PII (full name, DOB, contact) for **Care Recipients**. Decryption happens server-side; application code receives **Identity Token** + optional resolved `display_name`. RLS denies all non-service-role access.

**Invite Token**:
A row in `invite_tokens` — one-time-use **Membership** invitation. Deep-link payload on mobile; stored in `pending_invite_token` secure-storage if user not yet authed, redeemed via `POST /api/invite/{token}/accept` post-sign-in.

**Org Plan**:
The subscription tier on `organizations.plan` — `free` | `family` | `professional` | `enterprise`. Source of truth is Stripe; webhooks (`checkout.session.completed`, `customer.subscription.updated|deleted`) drive local sync. `$14/mo family plan` is the canonical paid tier; other tiers are placeholders pending product decision (see Ambiguities).

**Org Type**:
`organizations.org_type` — `family` | `agency` | `institution` | `employer`. Distinct from **Org Plan**; describes the social shape, not the billing tier.

**Entry Kind**:
`care_events.entry_kind` — `human` (user-authored) or `system` (Inngest/bot-authored). Controls edit permissions and UI badge.

### What gets logged (additions)

**Care Event Comment**:
A row in `care_event_comments` — flat (un-threaded) comment on a **Care Event**. Soft-delete only; body and author immutable post-insert. Encourages team discussion without rewriting history.
_Avoid_: note (collides with `care_events.note`), discussion.

**Care Event Medication Tag**:
A row in `care_event_medications` — M:N link between a **Care Event** and a **Medication**. Tracks `source` (manual vs OCR-extracted) and `confidence`.

**Dose Event**:
A computed view over **Care Events** filtered to medication-administration rows. Pure shape (`{id, recipient_id, occurred_at, event_type, payload.medication_id}`) consumed by adherence calculators; no DB table.

**Journal Reaction**:
A row in `journal_reactions` — emoji reaction on a **Care Event**. Enum: `heart` | `thinking_of_you` | `strong` | `grateful`. One reaction per (user, event); upsert semantics.
_Avoid_: like, emoji (too generic).

**Visit Recording**:
A row in `visit_recordings` — audio captured at an appointment. State machine: `pending` → `transcribing` (Whisper) → `extracting` (Claude) → `needs_review` → `confirmed` (creates a `visit_note` **Care Event**) | `failed`. PHI throughout. Distinct from **Visit Summary** (the print artifact).

### Documents pipeline

**OCR Job**:
A row in `ocr_jobs` — async pipeline state for an uploaded **Document**. States: `pending` → `processing` → `needs_review` → `confirmed` | `failed`. Routes are split across `/api/ocr/{upload, review, confirm, discard, save-fields}`. On confirm, may produce a **Medication** row (prescription scans) or a **Document** row (clinical scans). PHI-bearing.

### Schedules & summaries (additions)

**Shift Trade Request**:
A row in `shift_trade_requests` — a **Caregiver** proposes swapping their **Shift**. States: `open` | `accepted` | `declined` | `expired` | `cancelled`. Expiry auto-fires via Inngest `shiftTradeExpiry`.

**Shift Question**:
A row in `shift_questions` — append-only Q&A during/after a **Shift** handoff. Immutable except for `resolved_at` / `resolved_by` (BEFORE-UPDATE trigger enforces). PHI-bearing.

**Shift Handoff Entry**:
A row in `shifts_handoff_entries` — free-form note attached to a **Shift** at handoff. PHI-bearing.

**Coverage Window**:
A row in `coverage_windows` — recurring **Shift** template (e.g. "Mon 9a–5p"). Inserts produce concrete **Shifts** for assignment.

**Shift Band**:
A UI bucketing of **Shifts** into 4 coarse 24h slots (Day 8a–2p, Aft 2p–6p, Eve 6p–10p, Night 10p–8a). Pure presentation, not stored.

**Brief Headline**:
The editorial classifier on `care_briefs.headline` (JSONB, added 2026-04-29). One of seven states: `empty` | `crisis` | `flagged` | `difficult_run` | `single_entry` | `quiet_stable` | `default`. Emitted as a `Span[]` (text + optional `<em>` emphasis) for render-time typography. Legacy rows have `null`.

**Handoff Summary**:
The pre-**Visit Summary** editorial rollup built from the last 28 days of **Care Events**. Sub-shapes: `meds_summary`, `moments_summary`, `appointments_summary`, `concerns_summary`. PHI-bearing.

### Programs & planning (additions)

**Benefits Screener Answers**:
The structured input for **Benefits Screening** — booleans `age65plus`, `veteran`, `lowIncome`, `medicareEnrolled`, `medicaidEnrolled`. Maps deterministically to an eligible-programs list (Medicare Part D, Medicaid HCBS, VA Aid & Attendance, PACE, SHIP). Stored as JSONB on the screening row.

### Messaging & social

**Message Thread**:
A row in `message_threads` — chat container. `type='dm'` (NULL `name`) or `type='group'` (named). Org-scoped.

**Message Thread Member**:
A row in `message_thread_members` — explicit membership in a **Message Thread**, tracking `last_read_at` for unread badges. Distinct from **Membership** in an **Organization** — thread access is granular.

**Message**:
A row in `messages` — a single chat message. Soft-delete via `deleted_at`. No threading; replies are just newer messages in the same **Message Thread**.

**AI Conversation**:
A row in `ai_conversations` — stateful LLM chat session with `messages` (JSONB role/content array). Org-scoped; used by Care Assistant UI.

### Notifications & education

**Push Token**:
A row in `push_tokens` — APNs/FCM device token for a mobile **Membership** holder. User owns insert/delete.

**Web Push Subscription**:
A row in `web_push_subscriptions` — browser Web Push API endpoint + keys for an authed user. Separate channel from **Push Token**.

**Notification Preferences**:
A row in `notification_preferences` — per-user digest frequency (realtime / daily / weekly / never), quiet hours, channel toggles (push / email / SMS).

**Education Tip Cache**:
A row in `education_tip_cache` — wellness/caregiving tip rotation per org. Inngest `educationTipRefresh` syncs from external content source.

### Mobile sync model

**Offline Queue**:
The mobile-only write buffer in `expo-secure-store` (key `carelog_offline_queue`). Holds **QueuedWrites** when offline; flushes via tRPC on reconnect with idempotency keys.

**QueuedWrite**:
One pending mutation in the **Offline Queue**. Shape: `{id (idempotency UUID), event_type, entry_kind, payload, recipient_id, occurred_at (client-clock at write time), attempts}`. PHI when `event_type` is `medication` or `symptom`.

**Watch Message**:
A quick-log event from the native iOS `CarelogWatch` module via `expo-modules-core`. Bypasses screen flow and enqueues directly to **Offline Queue**. No-op on Android / Expo Go.

**Sync Status**:
Mobile-only state: `offline` (no network per NetInfo) | `pending` (queue length > 0) | `synced` (connected + empty). Polled every 2s; drives sync badge.

**Onboarding Flag**:
AsyncStorage boolean checked on first authed mount; gates the welcome → care-recipient → invite-team flow. Distinct from `users.is_onboarded` server flag.

### Async workflows (Inngest event catalog)

Handlers in `apps/web/inngest/functions/`. All payloads carry `org_id`; no cross-org fanout.

| Handler | Trigger | Purpose |
|---|---|---|
| `burnoutAlert` | New **Burnout Check-In** below threshold | Coordinator escalation |
| `careEventCommentFanout` | New **Care Event Comment** | Notify event watchers |
| `digestDeliveryMonitor` | After `weeklyDigest` send | Retry on failure |
| `documentsExtractText` | New **Document** upload | Extract searchable text |
| `educationTipRefresh` | Cron | Rotate **Education Tip Cache** |
| `gapDetector` | Cron | Alert on **Care Event** silence per recipient |
| `journalFlagAlert` | Flagged **Care Event** insert | Coordinator alert |
| `messagingPush` | New **Message** | Push notify thread members |
| `ocrDocument` | **OCR Job** for clinical doc | Extract text + categorize |
| `ocrPrescription` | **OCR Job** for prescription | Extract **Medication** fields |
| `rateLimit429Monitor` | Stripe 429 detection | Threshold alert |
| `refillAlert` | Cron + **Medication** supply check | Refill reminder |
| `shiftTradeExpiry` | Cron | Expire stale **Shift Trade Requests** |
| `weeklyDigest` | Cron (per-org minute offset via `digestMinuteOffset`) | Build + send **Weekly Digest** |

### Stripe / billing

**Stripe Customer Link**:
`organizations.stripe_id` ⟷ Stripe Customer ID. Webhook flow:
- `checkout.session.completed` → `plan='family'`, `stripe_id` set
- `customer.subscription.updated` → emit PostHog event
- `customer.subscription.deleted` → revert to `plan='free'`, clear `stripe_id`
- `invoice.payment_failed` → log (no auto-retry yet)

`session.metadata` carries `{ orgId, userId }`. Price ID for `$14/mo family` is env-driven (not hardcoded); verify in `/api/stripe/checkout/route.ts`.

### Outer Circle (clarified)

**Outer Circle Request**:
A row in `outer_circle_requests` — a tokenized share link for one **Care Brief**. Coordinator-created with `share_token`, `slots_total`, `slots_filled`, optional `title`/`description`. Anonymous SELECT allowed when `share_token IS NOT NULL` (token IS the secret). Revocation = set `share_token=NULL`; new tokens require a new request row.

**Outer Circle Claim**:
A row in `outer_circle_claims` — one-time-use redemption of an **Outer Circle Request**. INSERT requires `token_matches_request()`; SELECT is coordinator-only (claims are audit trail). The token holder provides `{name, email, note?, slot_date?}` via `POST /api/outer-circle/{token}/claim` → RPC `claim_outer_circle_slot`.

### Additional relationships

- A **Care Event** has zero or more **Care Event Comments** (1:N, flat) and zero or more **Journal Reactions** (1:N, one per user).
- A **Care Event** has zero or more **Care Event Medication Tags** linking to **Medications** (M:N).
- A **Visit Recording** may produce one `visit_note` **Care Event** on confirm (0:1).
- An **OCR Job** processes one **Document** or **Medication scan**; on confirm, writes to `documents` or `medications`.
- A **Shift** may have many **Shift Questions** and at most one open **Shift Trade Request**.
- A **Care Brief** has a **Brief Headline** (1:1, may be `null` for legacy rows).
- An **Organization** has one **Stripe Customer Link** (0:1).
- An **Organization** has many **Message Threads** (1:N); each **Message Thread** has its own **Message Thread Members** roster, distinct from **Memberships**.
- A user has many **Push Tokens** (1:N, one per device) and many **Web Push Subscriptions** (1:N, one per browser).
- A **Care Recipient** has one **Identity Vault** row and one **Identity Token** (1:1).
- An **Outer Circle Request** has zero or more **Outer Circle Claims** until `slots_filled >= slots_total`.

### RLS invariants worth pinning

- **`identity_vault` is service-role only.** Application code never reads decrypted PII via RLS.
- **`care_events` writes are role-gated** (caregiver / coordinator) even though reads are org-membership-wide.
- **`burnout_checkins` are author-private + coordinator-aggregate.** No update/delete policies → effectively immutable.
- **`outer_circle_requests` SELECT is anonymous when `share_token IS NOT NULL`.** The token is the only secret.
- **`shift_questions` body + author are trigger-enforced immutable** post-insert; only `resolved_*` mutable.
- **`care_event_comments` have no DELETE policy** → only soft-delete-via-update by the author.
- **`message_thread_members` controls thread access**, not **Membership** role.
- **pgTAP gaps**: `invite_tokens` (HIGH risk — invitation/expiry logic untested), `ocr_jobs` (MEDIUM — pipeline RLS unverified).

### Analytics PHI invariants

- No `posthog.identify()` call sites in the codebase (intentional — preserves UUID-only invariant).
- `posthog.capture` call sites (6): `/api/stripe/webhook`, `/api/referral/track`, `/api/ocr/confirm`, `/api/onboarding/create`, `/api/contact`, `/api/invite/{token}/accept`. All pass UUIDs only — no email/name/phone observed.
- **PHI-Critical to audit:** `/api/ocr/confirm/route.ts` — the OCR confirmation capture *could* include extracted drug names or dosages in `properties`. Verify the property whitelist before this lands in production. (Tracked in Phase 2 audit.)
- Sentry `setUser` / `setContext` not called anywhere — confirm intentional vs. gap before shipping observability work.

### Flagged ambiguities (additions)

- **Visit Summary vs Handoff Summary** — distinct artifacts. **Visit Summary** = print-friendly per-visit clinical transcript (`/visit-summary` route). **Handoff Summary** = lib-side rollup feeding **Visit Summary** and **Care Brief**. Both retained; this entry resolves the naming question.
- **`Org Plan` tiers beyond `family`** — `professional` and `enterprise` exist in the enum but have no product decision attached. Flagged as future-work; don't reference in user-facing copy.
- **`scan_source` on Medication** — `manual` vs `ocr_scan` only; no audit of which extractor (ocrPrescription handler).
- **`journal_reactions` schema TBD** — table exists; column-level shape (per-emoji counters vs per-user rows) needs confirmation against the canonical migration.
- **Stripe `price_id` env var name** — not explicitly documented; verify in checkout init route before Stripe upgrades.
- **`refillAlert` threshold + `shiftTradeExpiry` TTL** — both Inngest jobs use thresholds that are not centrally documented; surface in `docs/project-info/` before tuning.
- **Onboarding AsyncStorage key on mobile** — first-launch flag key not standardized; collision risk with future features.

### Flagged criticalities (action before production scale)

- **OCR PostHog payload audit** — see Analytics invariants above.
- **`expo-secure-store` encryption parity (iOS Keychain vs Android shared-prefs)** — verify before shipping mobile **Offline Queue** at scale; PHI-bearing entries (medication, symptom).
- **Client-clock `occurred_at`** in **QueuedWrite** — clock skew on mobile can desorder **Care Events**; consider server reconciliation on flush.
- **Outer Circle token rotation** — `share_token` is immutable; revocation clears it but issuing a replacement requires a new request row. UX implication for coordinator who wants to "rotate without losing claims history."
- **Identity Vault decrypt path undocumented** — schema creates the vault, but the decrypt seam (Supabase Vault, pgcrypto, app-layer key?) is not in any current doc.
